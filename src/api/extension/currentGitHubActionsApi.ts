import * as vscode from "vscode";
import { registerWorkflowTemplate } from "../../workflow/templates";
import { GitHubActionsApi, WorkflowTemplateDefinition } from "./api";

export class CurrentGitHubActionsApi implements GitHubActionsApi {
    registerWorkflowTemplate(definition: WorkflowTemplateDefinition): vscode.Disposable {
        return registerWorkflowTemplate(definition);
    }

    createWorkflowFromTemplate(templateId: string, callerContext?: never): Promise<void> {
        return this.createWorkflowFromTemplate(templateId, callerContext);
    }
}