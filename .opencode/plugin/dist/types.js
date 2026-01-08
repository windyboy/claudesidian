/**
 * Shared interfaces and types for OpenCode plugins
 * Used across all plugins in the Claudesidian migration
 */
/**
 * Error codes used across plugins
 */
export var ErrorCode;
(function (ErrorCode) {
    // Path validation errors
    ErrorCode["JAIL_VIOLATION"] = "JAIL_VIOLATION";
    ErrorCode["PROTECTED_PATH"] = "PROTECTED_PATH";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    // Command security errors
    ErrorCode["COMMAND_INJECTION"] = "COMMAND_INJECTION";
    ErrorCode["ENCODING_BYPASS"] = "ENCODING_BYPASS";
    ErrorCode["WHITELIST_VIOLATION"] = "WHITELIST_VIOLATION";
    // Plugin errors
    ErrorCode["DEPENDENCY_ERROR"] = "DEPENDENCY_ERROR";
    ErrorCode["LIFECYCLE_ERROR"] = "LIFECYCLE_ERROR";
    ErrorCode["ISOLATION_ERROR"] = "ISOLATION_ERROR";
    // Memory management errors
    ErrorCode["STORAGE_ERROR"] = "STORAGE_ERROR";
    ErrorCode["RETRIEVAL_ERROR"] = "RETRIEVAL_ERROR";
    ErrorCode["COMPACTION_ERROR"] = "COMPACTION_ERROR";
    // MCP server errors
    ErrorCode["RESOURCE_LIMIT_EXCEEDED"] = "RESOURCE_LIMIT_EXCEEDED";
    ErrorCode["SANDBOX_ERROR"] = "SANDBOX_ERROR";
    // General errors
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(ErrorCode || (ErrorCode = {}));
/**
 * Utility function to create a successful result
 */
export function createSuccessResult(data, metadata) {
    return {
        success: true,
        data,
        metadata: {
            timestamp: Date.now(),
            ...metadata
        }
    };
}
/**
 * Utility function to create an error result
 */
export function createErrorResult(code, message, details, metadata) {
    return {
        success: false,
        error: {
            code,
            message,
            details
        },
        metadata: {
            timestamp: Date.now(),
            ...metadata
        }
    };
}
