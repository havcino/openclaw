import type { ExecApprovalCommandHighlight } from "../exec-approvals.js";
import type { CommandExplanation, CommandRisk } from "./types.js";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function languageName(command: string): string {
  const lower = command.toLowerCase();
  if (lower.startsWith("python")) {
    return "Python";
  }
  if (lower === "node" || lower === "nodejs") {
    return "JavaScript";
  }
  if (lower === "ruby") {
    return "Ruby";
  }
  if (lower === "perl") {
    return "Perl";
  }
  if (lower === "php") {
    return "PHP";
  }
  return `${command} code`;
}

function inlineEvalWarning(risk: Extract<CommandRisk, { kind: "inline-eval" }>): string {
  return `${risk.command} ${risk.flag} can run any ${languageName(risk.command)} code on your computer.`;
}

function carrierWarning(risk: Extract<CommandRisk, { kind: "command-carrier" }>): string {
  const command = risk.command.toLowerCase();
  if (command === "find" && risk.flag) {
    return `find ${risk.flag} can run another command for every matching file.`;
  }
  if (command === "xargs") {
    return "xargs can build and run another command from input.";
  }
  if (command === "env" && risk.flag) {
    return `env ${risk.flag} can split text into another command.`;
  }
  return `${risk.command} can run another command.`;
}

function riskLine(risk: CommandRisk): string | null {
  switch (risk.kind) {
    case "inline-eval":
      return inlineEvalWarning(risk);
    case "command-carrier":
      return carrierWarning(risk);
    case "command-substitution":
      return "$(...) runs a hidden command first.";
    case "process-substitution":
      return "<(...) runs another command in the background.";
    case "dynamic-executable":
      return "The program name is built dynamically.";
    case "shell-wrapper":
      return `${risk.executable} ${risk.flag} can run extra system commands on your computer.`;
    case "shell-wrapper-through-carrier":
      return `${risk.command} can ask a shell to run extra system commands.`;
    case "eval":
      return "eval can turn text into commands and run them.";
    case "source":
      return `${risk.command} can load and run commands from another file.`;
    case "alias":
      return "alias can change what a command name means.";
    case "function-definition":
      return `This defines or changes the ${risk.name} command for this shell session.`;
    case "line-continuation":
      return "Line continuations can make separate-looking lines run as one command.";
    case "heredoc":
      return "This includes a block of text as command input.";
    case "here-string":
      return "This passes text directly into a command.";
    case "redirect":
      return "This command can read from or write to files.";
    case "syntax-error":
      return "OpenClaw could not fully understand this command.";
    case "dynamic-argument":
      return null;
  }
  return null;
}

function spanToHighlight(
  span: { startIndex: number; endIndex: number },
  kind: ExecApprovalCommandHighlight["kind"],
): ExecApprovalCommandHighlight | null {
  if (!Number.isSafeInteger(span.startIndex) || !Number.isSafeInteger(span.endIndex)) {
    return null;
  }
  if (span.startIndex < 0 || span.endIndex <= span.startIndex) {
    return null;
  }
  return { startIndex: span.startIndex, endIndex: span.endIndex, kind };
}

export function formatCommandExplanationHighlights(
  explanation: CommandExplanation,
): ExecApprovalCommandHighlight[] {
  const highlights: ExecApprovalCommandHighlight[] = [];
  for (const command of [...explanation.topLevelCommands, ...explanation.nestedCommands]) {
    const commandNameLength = command.executable.length;
    const commandHighlight = spanToHighlight(
      {
        startIndex: command.span.startIndex,
        endIndex: command.span.startIndex + commandNameLength,
      },
      "command",
    );
    if (commandHighlight) {
      highlights.push(commandHighlight);
    }
  }
  for (const risk of explanation.risks) {
    if (risk.kind === "command-carrier") {
      const riskText = risk.flag ?? risk.command;
      const relativeStart = risk.text.indexOf(riskText);
      const startIndex =
        relativeStart >= 0 ? risk.span.startIndex + relativeStart : risk.span.startIndex;
      const riskHighlight = spanToHighlight(
        { startIndex, endIndex: startIndex + riskText.length },
        "risk",
      );
      if (riskHighlight) {
        highlights.push(riskHighlight);
      }
      continue;
    }
    if (risk.kind === "inline-eval") {
      const riskText = `${risk.command} ${risk.flag}`;
      const relativeStart = risk.text.indexOf(riskText);
      const startIndex =
        relativeStart >= 0 ? risk.span.startIndex + relativeStart : risk.span.startIndex;
      const riskHighlight = spanToHighlight(
        { startIndex, endIndex: startIndex + riskText.length },
        "risk",
      );
      if (riskHighlight) {
        highlights.push(riskHighlight);
      }
    }
  }
  return highlights;
}

export function formatCommandExplanationLines(explanation: CommandExplanation): string[] {
  const lines: string[] = [];
  const riskLines = unique(
    explanation.risks.map(riskLine).filter((line): line is string => Boolean(line)),
  );
  if (riskLines.length > 0) {
    lines.push("Risks:", ...riskLines.map((line) => `• ${line}`));
  }
  if (!explanation.ok && !riskLines.some((line) => line.includes("could not fully understand"))) {
    if (riskLines.length === 0) {
      lines.push("Risks:");
    }
    lines.push("• OpenClaw could not fully understand this command.");
  }
  return lines;
}
