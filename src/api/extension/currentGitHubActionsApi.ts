import * as vscode from "vscode";
import { createWorkflowFromTemplate, registerWorkflowTemplate } from "../../workflow/templates";
import { GitHubActionsApi, StarterWorkflowTemplateDefinition, WorkflowTemplateDefinition } from "./api";

export class CurrentGitHubActionsApi implements GitHubActionsApi {
    registerStarterWorkflowTemplate(definition: StarterWorkflowTemplateDefinition): vscode.Disposable {
        return this.registerStarterWorkflowTemplate(definition);
    }

    registerWorkflowTemplate(definition: WorkflowTemplateDefinition): vscode.Disposable {
        return registerWorkflowTemplate(definition);
    }

    createWorkflowFromTemplate(templateId: string, callerContext?: never): Promise<void> {
        return createWorkflowFromTemplate(undefined, templateId, callerContext);
    }
}