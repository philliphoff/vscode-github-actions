import * as vscode from "vscode";

/**
 * Context provided to the GitHub workflow provider when asked to create a workflow.
 */
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
     * Initial name for a new workflow file. Populated, for example, when creating a starter workflow.
     */
    readonly suggestedFileName?: string;

    /**
     * The type of workflow being created. This can be useful when the same handler is used for multiple workflow types.
     */
    readonly type: string;

    /**
     * The URI for the workspace in which the workflow will be created.
     */
    readonly workspaceUri: vscode.Uri;

    /**
     * Creates a new workflow file.
     *
     * @param suggestedFileName The suggested file name for a new workflow.
     * @param content The content of the workflow.
     *
     * @returns The actual URI of the created workflow.
     */
    createWorkflowFile(suggestedFileName: string, content: string): Promise<vscode.Uri | undefined>;

    /**
     * Creates or updates an actions secret in the GitHub repository.
     *
     * @param suggestedName The suggested name for the secret.
     * @param value The new value of the secret.
     *
     * @returns The actual name of the created/updated secret.
     */
    setSecret(suggestedName: string, value: string): Promise<string | undefined>;
}

export interface GitHubWorkflowProvider {
    createWorkflow(context: WorkflowCreationContext): Promise<void>;
}

/**
 * The current (v1) GitHub Actions extension API.
 */
export interface GitHubActionsApi {
    /**
     * Creates a new workflow.
     *
     * @param type The type of workflow to create. If omitted or undefined, the user will be prompted to select a workflow.
     * @param callerContext An optional, opaque object provided to the workflow provider.
     *
     * @returns The URIs of all created workflow files.
     */
    createWorkflow(type?: string, callerContext?: never): Promise<vscode.Uri[]>;

    /**
     * Registers a provider of a specific workflow type.
     *
     * @param type The type of workflow associated with the provider.
     * @param provider The provider that will handle creating workflows of the specified type.
     *
     * @returns A disposable that will unregister the provider.
     */
    registerWorkflowProvider(type: string, provider: GitHubWorkflowProvider): vscode.Disposable;
}

/**
 * Exported object of the GitHub Actions extension.
 */
export interface GitHubActionsApiManager {

    /**
     * Gets a specific version of the GitHub Actions extension API.
     *
     * @typeparam T The type of the API.
     * @param version The version of the API to return. Defaults to the latest version.
     *
     * @returns The requested API or undefined, if not available.
     */
    getApi<T>(version: 1): T | undefined
}