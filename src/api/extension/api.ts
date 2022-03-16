import * as vscode from "vscode";

export interface WorkflowResult<T> {
    result?: T;
    succeeded: boolean;
}

export interface WorkflowCreationContext {
    /**
     * Optional and opaque context provided by the caller when creating the workflow.
     */
    readonly callerContext?: never;

    /**
     * Initial content (if any) for a new workflow. Populated, for example, when creating a starter workflow.
     */
    readonly content?: string;

    /**
     * Creates a new workflow file.
     *
     * @param suggestedFileName The suggested file name for a new workflow.
     * @param content The content of the workflow.
     *
     * @returns The actual URI of the created workflow.
     */
    createWorkflowFile(suggestedFileName: string, content: string): Promise<WorkflowResult<vscode.Uri>>;

    /**
     * Creates or updates an actions secret in the GitHub repository.
     *
     * @param suggestedName The suggested name for the secret.
     * @param value The new value of the secret.
     *
     * @returns The actual name of the created/updated secret.
     */
    setSecret(suggestedName: string, value: string): Promise<WorkflowResult<string>>;
}

export interface GitHubWorkflowProvider {
    createWorkflow(context: WorkflowCreationContext): Promise<void>;
}

export interface GitHubActionsApi {
    createWorkflow(type: string, callerContext?: never): Promise<void>;

    registerWorkflowProvider(type: string, provider: GitHubWorkflowProvider): vscode.Disposable;
}

export interface GitHubActionsApiManager {
    getApi<T>(version: 1): T | undefined
}