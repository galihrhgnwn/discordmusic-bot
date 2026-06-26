#!/usr/bin/env node

import { spawn } from "child_process";
import readline from "readline";
import os from "os";
import path from "path";

const USERNAME = "galihrhgnwn";
let cwd = process.env.HOME || "/";

function getPrompt() {
  const short = cwd.replace(os.homedir(), "~");
  return `${USERNAME} ${short} $: `;
}

function runNeofetch() {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", "neofetch --stdout 2>/dev/null || neofetch 2>/dev/null"], {
      cwd,
      env: process.env,
      stdio: ["ignore", "inherit", "ignore"],
    });
    child.on("close", (code) => {
      if (code !== 0) process.stdout.write("[neofetch not found]\n\n");
      resolve();
    });
    child.on("error", () => {
      process.stdout.write("[neofetch not found]\n\n");
      resolve();
    });
  });
}

function runCommand(input) {
  return new Promise((resolve) => {
    const trimmed = input.trim();
    if (!trimmed) return resolve();

    if (trimmed === "exit" || trimmed === "quit") {
      process.stdout.write("exit\n");
      process.exit(0);
    }

    if (trimmed.startsWith("cd")) {
      const target = trimmed.slice(2).trim() || (process.env.HOME || "/");
      const newPath = path.resolve(cwd, target);
      try {
        process.chdir(newPath);
        cwd = newPath;
      } catch {
        process.stdout.write(`bash: cd: ${target}: No such file or directory\n`);
      }
      return resolve();
    }

    const child = spawn("sh", ["-c", trimmed], {
      cwd,
      env: process.env,
      stdio: ["inherit", "inherit", "inherit"],
    });

    child.on("error", (err) => {
      process.stdout.write(`Error: ${err.message}\n`);
      resolve();
    });

    child.on("close", () => resolve());
  });
}

async function main() {
  await runNeofetch();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
  });

  const prompt = () => {
    rl.question(getPrompt(), async (input) => {
      await runCommand(input);
      prompt();
    });
  };

  prompt();
}

main();
