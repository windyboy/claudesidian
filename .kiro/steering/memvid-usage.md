---
inclusion: always
---

# Memvid Usage Guidelines for Kiro

When working with this project, use Memvid MCP server for session memory and context preservation.

## Memory File Strategy

- **Project Memory**: Use `opendian.mv2` for long-term project knowledge
- **Session Memory**: Create daily files like `session-YYYY-MM-DD.mv2`
- **Context Memory**: Use `context-current.mv2` for active working context

## Essential Commands

### Create Memory File
```
mcp_memvid_memvid_create(
  file_path="filename.mv2",
  description="Purpose description"
)
```

### Add Content
```
mcp_memvid_memvid_add_text(
  file_path="filename.mv2",
  content="Content text",
  title="Descriptive title",
  tags={"type": "discussion|decision|issue|solution", "topic": "feature-name"}
)
```

### Search Memory
```
mcp_memvid_memvid_search(
  file_path="filename.mv2",
  query="search terms",
  top_k=5
)
```

### Save Changes
```
mcp_memvid_memvid_commit(file_path="filename.mv2")
```

## Session Workflow

1. **Start**: Create or retrieve session memory file
2. **Capture**: Add important discussions, decisions, and insights with proper tags
3. **Search**: Use previous context to inform current work
4. **End**: Commit changes and add session summary

## Tagging Strategy

Use consistent tags:
- `type`: discussion, decision, issue, solution, documentation
- `topic`: feature name, component, or area
- `status`: open, completed, blocked
- `priority`: low, medium, high

## When to Use Memvid

- Capture architectural decisions and rationale
- Store user requirements and feedback
- Document debugging sessions and solutions
- Preserve context between sessions
- Build project knowledge base
- Record important insights and learnings

Always commit changes after adding content to ensure persistence.