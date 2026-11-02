import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedAnswer } from '../entities/saved-answer.entity';

@Injectable()
export class SavedAnswersService {
  private readonly logger = new Logger(SavedAnswersService.name);

  constructor(
    @InjectRepository(SavedAnswer)
    private readonly repo: Repository<SavedAnswer>,
  ) {}

  /**
   * Load all saved answers for a client + ATS as a plain dict.
   * This is what gets passed into LlmMappingService.mapQuestions()
   * so it can skip the LLM for known questions.
   */
  async getAnswerMap(
    clientId: string,
    atsType: string = 'greenhouse',
  ): Promise<Record<string, string>> {
    const answers = await this.repo.find({
      where: { client: { id: clientId }, atsType },
    });

    return Object.fromEntries(answers.map(a => [a.questionName, a.answer]));
  }

  /**
   * Save or update a single answer.
   * Called when:
   *   - A human resolves a Route C question in the review queue
   *   - User sets a permanent answer from their profile settings
   *
   * Uses upsert logic — if this question already has a saved answer
   * for this client, it updates it rather than creating a duplicate.
   */
  async upsertAnswer(params: {
    clientId: string;
    questionName: string;
    questionLabel: string;
    answer: string;
    atsType: string;
    source: 'user' | 'review_resolution' | 'llm_confirmed';
  }): Promise<SavedAnswer> {
    const existing = await this.repo.findOne({
      where: {
        client: { id: params.clientId },
        questionName: params.questionName,
        atsType: params.atsType,
      },
    });

    if (existing) {
      await this.repo.update(existing.id, {
        answer: params.answer,
        source: params.source,
        useCount: existing.useCount + 1,
      });
    const updated = await this.repo.findOne({ where: { id: existing.id } });

if (!updated) {
  throw new Error('Updated answer not found');
}

return updated;
    }

    const saved = this.repo.create({
      questionName: params.questionName,
      questionLabel: params.questionLabel,
      answer: params.answer,
      atsType: params.atsType,
      source: params.source,
      useCount: 0,
      client: { id: params.clientId },
    });

    return this.repo.save(saved);
  }

  /**
   * Bulk save answers — used after a successful application to persist
   * any LLM-generated answers the user wants to keep for next time.
   */
  async bulkUpsert(
    clientId: string,
    answers: Array<{
      questionName: string;
      questionLabel: string;
      answer: string;
      atsType: string;
    }>,
  ): Promise<void> {
    for (const a of answers) {
      await this.upsertAnswer({
        clientId,
        ...a,
        source: 'llm_confirmed',
      });
    }
    this.logger.log(`Bulk saved ${answers.length} answers for client ${clientId}`);
  }

  /**
   * Increment use count for a question — called each time a saved
   * answer is used in an application. Useful for analytics.
   */
  async incrementUseCount(clientId: string, questionName: string, atsType: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(SavedAnswer)
      .set({ useCount: () => '"use_count" + 1' })
      .where('client_id = :clientId AND question_name = :questionName AND ats_type = :atsType', {
        clientId, questionName, atsType,
      })
      .execute();
  }

  /**
   * Get all saved answers for a client — for their profile settings UI.
   */
  async getAllForClient(clientId: string): Promise<SavedAnswer[]> {
    return this.repo.find({
      where: { client: { id: clientId } },
      order: { useCount: 'DESC' },
    });
  }

  /**
   * Delete a saved answer — user wants to reset a specific question.
   */
  async delete(id: string, clientId: string): Promise<void> {
    await this.repo.delete({ id, client: { id: clientId } });
  }
}