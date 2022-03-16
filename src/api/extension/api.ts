import * as vscode from "vscode";

export interface WorkflowResult<T> {
    result?: T;
    succeeded: boolean;
}

export interface WorkflowCreationContext {
    readonly callerContext?: never;
    readonly content?: string;

    createWorkflowFromContent(suggestedFileName: string, content: string): Promise<WorkflowResult<vscode.Uri>>;

    /**
     * Sets or updates an actions secret in the GitHub repository.
     *
     * @param suggestedName The suggested name for the secret.
     * @param value The value of the secret.
     *
     * @returns The actual name of the created/set secret.
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
    getApi<T>(version: string): T | undefined
}