import * as vscode from "vscode";

export interface WorkflowResult<T> {
    result?: T;
    succeeded: boolean;
}

export interface WorkflowCreationContext {
    callerContext?: never;

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

export interface WorkflowTemplateDefinition {
    readonly id: string;
    readonly title: string;
    readonly description: string;

    onCreate?: (context: WorkflowCreationContext) => Promise<void>;
}

export interface GitHubActionsApi {
    registerWorkflowTemplate(definition: WorkflowTemplateDefinition): vscode.Disposable;
    createWorkflowFromTemplate(templateId: string, callerContext?: never): Promise<void>;
}

export interface GitHubActionsApiManager {
    getApi<T>(version: string): T | undefined
}