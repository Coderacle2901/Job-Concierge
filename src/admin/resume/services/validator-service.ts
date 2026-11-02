import { Injectable, BadRequestException, Logger } from '@nestjs/common';

const VALID_NODE_TYPES = [
  'text',
  'section',
  'paragraph',
  'bulletPoint',
  'bulletList',
  'jobEntry',
  'contactRow',
  'companyInfo',
  'dateLocation',
  'link',
  'skillCategories',
  'category',
  'educationEntry',
] as const;

type NodeType = typeof VALID_NODE_TYPES[number];

const REQUIRED_SECTIONS = [
  'metadata',
  'personalInfo',
  'professionalSummary',
  'workExperience',
  'skills',
  'education',
] as const;

const VALUE_REQUIRED_TYPES: NodeType[] = ['text', 'link'];

const CHILDREN_REQUIRED_TYPES: NodeType[] = [
  'section',
  'paragraph',
  'bulletList',
  // bulletPoint removed — supports both value string and children array
  'jobEntry',
  'contactRow',
  'companyInfo',
  'dateLocation',
  'skillCategories',
];

@Injectable()
export class ResumeValidatorService {
  private readonly logger = new Logger(ResumeValidatorService.name);

  validate(resumeJson: Record<string, any>): void {
    this.logger.log('Validating Atomic JSON structure...');
    this.validateMetadata(resumeJson);
    this.validateRequiredSections(resumeJson);

    const collectedIds = new Set<string>();

    for (const section of REQUIRED_SECTIONS) {
      if (section === 'metadata') continue;
      this.validateNode(resumeJson[section], section, collectedIds);
    }

    this.logger.log('Atomic JSON validation passed.');
  }

  private validateMetadata(resumeJson: Record<string, any>): void {
    const metadata = resumeJson['metadata'];

    if (!metadata) {
      throw new BadRequestException('Resume JSON is missing required "metadata" field');
    }

    if (!metadata.resumeName || typeof metadata.resumeName !== 'string') {
      throw new BadRequestException('metadata.resumeName is required and must be a string');
    }

    if (!metadata.version) {
      throw new BadRequestException('metadata.version is required');
    }
  }

  private validateRequiredSections(resumeJson: Record<string, any>): void {
    for (const section of REQUIRED_SECTIONS) {
      if (!resumeJson[section]) {
        throw new BadRequestException(
          `Resume JSON is missing required section: "${section}"`,
        );
      }
    }
  }

  private validateNode(
    node: any,
    path: string,
    collectedIds: Set<string>,
  ): void {
    if (!node || typeof node !== 'object') {
      throw new BadRequestException(
        `Invalid node at "${path}" — expected an object`,
      );
    }

    // ── Validate type ────────────────────────────────────────────────────────
    if (!node.type) {
      throw new BadRequestException(
        `Node at "${path}" is missing required "type" field`,
      );
    }

    if (!VALID_NODE_TYPES.includes(node.type)) {
      throw new BadRequestException(
        `Node at "${path}" has invalid type "${node.type}". ` +
        `Valid types are: ${VALID_NODE_TYPES.join(', ')}`,
      );
    }

    // ── Validate id uniqueness ───────────────────────────────────────────────
    if (node.id) {
      if (collectedIds.has(node.id)) {
        throw new BadRequestException(
          `Duplicate node id "${node.id}" found at "${path}". ` +
          `Every node id must be unique within the resume.`,
        );
      }
      collectedIds.add(node.id);
    }

    // ── Validate value field ─────────────────────────────────────────────────
    if (VALUE_REQUIRED_TYPES.includes(node.type)) {
      if (!node.value || typeof node.value !== 'string') {
        throw new BadRequestException(
          `Node of type "${node.type}" at "${path}" must have a non-empty "value" string`,
        );
      }
    }

    // ── Validate link url ────────────────────────────────────────────────────
    if (node.type === 'link') {
      if (!node.url || typeof node.url !== 'string') {
        throw new BadRequestException(
          `Link node at "${path}" must have a "url" field`,
        );
      }
    }

    // ── Validate formatting object ───────────────────────────────────────────
    if (node.formatting !== undefined) {
      this.validateFormatting(node.formatting, path);
    }

    // ── Validate bulletPoint — supports value string OR children array ────────
    if (node.type === 'bulletPoint') {
      const hasChildren =
        node.children &&
        Array.isArray(node.children) &&
        node.children.length > 0;
      const hasValue = node.value && typeof node.value === 'string';

      if (!hasChildren && !hasValue) {
        throw new BadRequestException(
          `bulletPoint node at "${path}" must have either a "children" array or a "value" string`,
        );
      }

      // If it has children, validate them recursively
      if (hasChildren) {
        node.children.forEach((child: any, index: number) => {
          this.validateNode(child, `${path}.children[${index}]`, collectedIds);
        });
      }

      return;
      // Early return — skip the generic children check below
      // since bulletPoint has its own validation logic above
    }

    // ── Validate children for all other types ────────────────────────────────
    if (CHILDREN_REQUIRED_TYPES.includes(node.type)) {
      if (!node.children || !Array.isArray(node.children)) {
        throw new BadRequestException(
          `Node of type "${node.type}" at "${path}" must have a "children" array`,
        );
      }

      if (node.children.length === 0) {
        throw new BadRequestException(
          `Node of type "${node.type}" at "${path}" must have at least one child`,
        );
      }

      node.children.forEach((child: any, index: number) => {
        this.validateNode(child, `${path}.children[${index}]`, collectedIds);
      });
    }

    // ── Validate category skills array ───────────────────────────────────────
    if (node.type === 'category') {
      if (!node.skills || !Array.isArray(node.skills)) {
        throw new BadRequestException(
          `Category node at "${path}" must have a "skills" array`,
        );
      }

      node.skills.forEach((skill: any, index: number) => {
        if (!skill.value || typeof skill.value !== 'string') {
          throw new BadRequestException(
            `Skill at "${path}.skills[${index}]" must have a "value" string`,
          );
        }
      });
    }
  }

  private validateFormatting(formatting: any, path: string): void {
    if (typeof formatting !== 'object' || Array.isArray(formatting)) {
      throw new BadRequestException(
        `"formatting" at "${path}" must be an object`,
      );
    }

    if (formatting.fontSize !== undefined) {
      if (typeof formatting.fontSize !== 'number' || formatting.fontSize <= 0) {
        throw new BadRequestException(
          `"formatting.fontSize" at "${path}" must be a positive number`,
        );
      }
    }

    if (formatting.color !== undefined) {
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexColorRegex.test(formatting.color)) {
        throw new BadRequestException(
          `"formatting.color" at "${path}" must be a valid hex color (e.g. "#3182ce")`,
        );
      }
    }

    const validAlignments = ['left', 'center', 'right', 'justify'];
    if (
      formatting.alignment !== undefined &&
      !validAlignments.includes(formatting.alignment)
    ) {
      throw new BadRequestException(
        `"formatting.alignment" at "${path}" must be one of: ${validAlignments.join(', ')}`,
      );
    }

    if (formatting.bold !== undefined && typeof formatting.bold !== 'boolean') {
      throw new BadRequestException(
        `"formatting.bold" at "${path}" must be a boolean`,
      );
    }

    if (formatting.italic !== undefined && typeof formatting.italic !== 'boolean') {
      throw new BadRequestException(
        `"formatting.italic" at "${path}" must be a boolean`,
      );
    }
  }
}