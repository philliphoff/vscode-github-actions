import * as vscode from "vscode";
import { createWorkflow, registerWorkflowProvider } from "../../workflow/templates";
import { GitHubActionsApi, GitHubWorkflowProvider } from "./api";

export class CurrentGitHubActionsApi implements GitHubActionsApi {
    createWorkflow(type: string, callerContext?: never): Promise<void> {
        return createWorkflow(undefined, type, callerContext);
    }

    registerWorkflowProvider(type: string, provider: GitHubWorkflowProvider): vscode.Disposable {
        return registerWorkflowProvider(type, provider);
    }
}