---
inclusion: manual
---

# Kiro Specifications

This directory contains detailed specifications for various components and features of the Claudesidian project.

## Available Specifications

### [Claudesidian OpenCode Migration Specification](./CLAUDESIDIAN-OPENCODE-SPEC.md)

**Status**: Draft  
**Version**: 1.0  
**Last Updated**: 2026-01-08

Complete implementation specification for migrating Claudesidian from a monolithic Obsidian plugin to a distributed OpenCode-based architecture.

**Key Features:**
- 9 modular OpenCode plugins with clear responsibilities
- Enhanced security with command whitelisting and path validation
- Memory management integration with Memvid MCP
- Comprehensive testing and deployment specifications
- 4-phase migration plan with rollback procedures

**Sections:**
- System Requirements
- Architecture Components  
- Plugin Specifications (9 plugins)
- API Specifications
- Configuration Specifications
- Security Specifications
- Testing Specifications
- Deployment Specifications
- Migration Specifications

---

## Specification Guidelines

When adding new specifications to this directory:

1. **Naming Convention**: Use descriptive names with `-SPEC.md` suffix
2. **Structure**: Follow the template structure with clear sections
3. **Version Control**: Include version and last updated date
4. **Status**: Mark as Draft, Review, Approved, or Deprecated
5. **Update Index**: Add entry to this README.md file

## Related Documents

- [Architecture Design](../OPENCODE-ARCHITECTURE-DESIGN.md) - High-level architecture overview
- [Migration Plan](../OPENCODE-MIGRATION-PLAN.md) - Migration strategy and timeline
- [Agents Guide](../AGENTS.md) - Development guidelines for agents
- [Permission System](../PERMISSION-SYSTEM.md) - Permission system documentation