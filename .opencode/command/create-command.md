---
agent: bootstrap
description: Create a new OpenCode slash command
argument-hint: [command details or description]
---

# Create New Slash Command

I'll help you create a new OpenCode slash command.

## Your Input

**Command Details:** $ARGUMENTS

## Process

1. **Understand Requirements**
   - What should be command do?
   - What tools does it need?
   - What output should it produce?

2. **Design Structure**
   - Command name (kebab-case)
   - Required agent
   - Input arguments
   - Output format

3. **Create Command File**
   - Location: `.opencode/command/[command-name].md`
   - Include proper frontmatter
   - Clear instructions
   - Example usage

## Command Template

```markdown
---
agent: [agent-name]
description: [One-line description]
argument-hint: [What user should provide]
---

# Command Name

Brief description of what this command does.

## Task

[Clear description of task]

## Process

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Output

[Expected output format]

## Example Usage

\`\`\` /command-name [arguments] \`\`\`
```

## Best Practices

- Keep commands focused on one task
- Use clear, descriptive names
- Include example usage
- Document required arguments
- Specify output format
- Choose appropriate agent:
  - `bootstrap` for setup, git operations, system changes
  - `thinking-partner` for collaborative exploration
  - `research-assistant` for information gathering
  - `assistant` for standard file operations
  - `read-only` for content review only

Let me help you create your command!
