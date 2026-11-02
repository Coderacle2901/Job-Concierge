import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseResume } from '../entities/base-resume.entity';

@Injectable()
export class ResumeVersionService {
  private readonly logger = new Logger(ResumeVersionService.name);

  constructor(
    @InjectRepository(BaseResume)
    private readonly baseResumeRepo: Repository<BaseResume>,
  ) {}

  // ─── DUPLICATE BASE RESUME ─────────────────────────────────────────────────

  async duplicate(
    resumeId: string,
    newResumeName: string,
  ): Promise<BaseResume> {
    // Fetches the original resume and creates a new record that is
    // an exact copy of it with a new name and a parentResumeId pointing
    // back to the original.
    //
    // The duplicate is NOT saved here — it is returned as an unsaved
    // entity object. ResumeService is responsible for running validation
    // and saving it. This keeps each service focused on one job.

    const original = await this.baseResumeRepo.findOne({
      where: { id: resumeId },
      relations: ['client', 'createdBy'],
      // Loading relations so the duplicate inherits the same
      // client and createdBy references as the original.
    });

    if (!original) {
      throw new NotFoundException(
        `Base resume with id ${resumeId} not found`,
      );
    }

    this.logger.log(
      `Duplicating resume "${original.resumeName}" → "${newResumeName}"`,
    );

    // Deep clone the resumeJson to ensure the duplicate has its own
    // independent copy of the JSON. Without this, both records would
    // reference the same object in memory and edits to one would
    // affect the other before saving.
    const clonedJson = JSON.parse(JSON.stringify(original.resumeJson));

    // Update metadata inside the cloned JSON to reflect the new name
    // and reset the timestamps
    if (clonedJson.metadata) {
      clonedJson.metadata.resumeName = newResumeName;
      clonedJson.metadata.updatedAt = new Date().toISOString();
      clonedJson.metadata.atsBaselineScore = null;
      // ATS score is reset to null — it will be recalculated
      // after the duplicate is saved via ResumeAtsService
    }

    // Build the new entity without saving it
    const duplicate = this.baseResumeRepo.create({
      resumeName: newResumeName,
      resumeJson: clonedJson,
      atsBaselineScore: null,
      version: 1,
      // Version resets to 1 for the duplicate — it starts
      // its own independent edit history from this point
      parentResumeId: original.id,
      // parentResumeId links back to the original so we can
      // always trace the version chain:
      // Base v1 → Tech Focus v2 → Remote Focus v3
      isActive: true,
      client: original.client,
      createdBy: original.createdBy,
    });

    return duplicate;
    // Returned unsaved — ResumeService calls validate() then save()
  }

  // ─── GET VERSION CHAIN ─────────────────────────────────────────────────────

  async getVersionChain(resumeId: string): Promise<BaseResume[]> {
    // Returns all resumes in the version chain for a given resume.
    // Walks up the parentResumeId chain to find the root, then
    // fetches all resumes that share the same root.
    //
    // Used in the admin dashboard to show the full version history
    // of a base resume and all its variants.
    //
    // Example result for "Remote Focus v3":
    // [Base v1, Tech Focus v2, Remote Focus v3]

    const resume = await this.baseResumeRepo.findOne({
      where: { id: resumeId },
    });

    if (!resume) {
      throw new NotFoundException(
        `Base resume with id ${resumeId} not found`,
      );
    }

    // Find the root of the chain by walking up parentResumeId
    const rootId = await this.findRootId(resumeId);

    // Fetch all resumes that are descendants of the root
    // including the root itself
    return this.baseResumeRepo
      .createQueryBuilder('resume')
      .where(
        'resume.id = :rootId OR resume.parentResumeId = :rootId',
        { rootId },
      )
      .orderBy('resume.createdAt', 'ASC')
      .getMany();
  }

  // ─── DELETE ENTRY FROM JSON ────────────────────────────────────────────────

  deleteJsonEntry(
    resumeJson: Record<string, any>,
    entryId: string,
  ): Record<string, any> {
    // Removes a specific node from the Atomic JSON tree by its id.
    // Used when admin wants to delete a specific bullet point,
    // job entry, skill, or education entry from a resume.
    //
    // Returns the modified JSON — does NOT save to DB.
    // ResumeService is responsible for saving after calling this.

    let found = false;

    const walk = (node: any): any => {
      if (!node || typeof node !== 'object') return node;
      if (Array.isArray(node)) {
        // Filter out the node with the matching id
        // then recursively walk remaining nodes
        return node
          .filter((child) => {
            if (child?.id === entryId) {
              found = true;
              return false; // remove this node
            }
            return true;
          })
          .map(walk);
      }

      if (node.children && Array.isArray(node.children)) {
        node.children = walk(node.children);
      }

      if (node.skills && Array.isArray(node.skills)) {
        node.skills = node.skills.filter((skill: any) => {
          if (skill?.id === entryId) {
            found = true;
            return false;
          }
          return true;
        });
      }

      return node;
    };

    const updatedJson = walk(JSON.parse(JSON.stringify(resumeJson)));

    if (!found) {
      throw new NotFoundException(
        `Node with id "${entryId}" not found in resume JSON`,
      );
    }

    return updatedJson;
  }

  // ─── PRIVATE: FIND ROOT ID ─────────────────────────────────────────────────

  private async findRootId(resumeId: string): Promise<string> {
    // Walks up the parentResumeId chain until it finds a resume
    // with no parent — that is the root of the version chain.

    let currentId = resumeId;

    while (true) {
      const current = await this.baseResumeRepo.findOne({
        where: { id: currentId },
      });

      if (!current) break;

      if (!current.parentResumeId) {
        // No parent means this is the root
        return currentId;
      }

      currentId = current.parentResumeId;
    }

    return currentId;
  }
}