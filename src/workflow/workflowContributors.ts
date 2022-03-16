import * as vscode from 'vscode';

interface StarterWorkflowContribution {
    readonly workflow: string;
}

export interface CustomWorkflowContribution {
    readonly workflow: string;
    readonly title: string;
    readonly description: string;
    readonly group: string;
}

type WorkflowContribution = StarterWorkflowContribution | CustomWorkflowContribution;

interface ExtensionPackage {
    readonly contributes?: {
        readonly 'x-github-workflows'?: WorkflowContribution[];
    };
}

function isCustomWorkflow(contribution: WorkflowContribution): contribution is CustomWorkflowContribution {
    return (contribution as CustomWorkflowContribution).title !== undefined;
}

export async function activateExtensionForWorkflow(type: string): Promise<string | undefined> {
    const extensionAndContributions =
        vscode.extensions.all
            .map(extension => ({ extension, contributions: (extension.packageJSON as ExtensionPackage)?.contributes?.['x-github-workflows'] ?? [] }))
            .find(extensionAndContributions => extensionAndContributions.contributions.find(contribution => contribution.workflow === type) !== undefined);

    if (extensionAndContributions) {
        if (!extensionAndContributions.extension.isActive) {
            await extensionAndContributions.extension.activate();
        }

        return extensionAndContributions.extension.id;
    } else {
        return undefined;
    }
}

export function getCustomWorkflows(): CustomWorkflowContribution[] {
    return vscode.extensions.all
        .map(extension => (extension.packageJSON as ExtensionPackage)?.contributes?.['x-github-workflows'] ?? [])
        .flatMap(workflow => workflow)
        .filter(isCustomWorkflow);
}