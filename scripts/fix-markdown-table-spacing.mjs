#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

function collectMarkdownFiles(targetPath, files = []) {
  if (!fs.existsSync(targetPath)) return files

  const stat = fs.statSync(targetPath)
  if (stat.isFile()) {
    if (targetPath.endsWith('.md')) files.push(targetPath)
    return files
  }

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    collectMarkdownFiles(path.join(targetPath, entry.name), files)
  }
  return files
}

function isTableLine(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return false
  if (trimmed === '|') return false
  return trimmed.includes('|')
}

function normalizeTableRow(line) {
  const trimmed = line.trim()
  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

  return `| ${cells.join(' | ')} |`
}

function fixFile(filePath) {
  const input = fs.readFileSync(filePath, 'utf8')
  const lines = input.split(/\r?\n/)

  let inCodeFence = false
  const output = lines.map((line) => {
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence
      return line
    }

    if (inCodeFence) return line
    if (!isTableLine(line)) return line

    return normalizeTableRow(line)
  })

  const next = output.join('\n')
  if (next === input) return false

  fs.writeFileSync(filePath, next, 'utf8')
  return true
}

const cliTargets = process.argv.slice(2)
const targets = cliTargets.length > 0 ? cliTargets : ['.']

const files = new Set()
for (const target of targets) {
  const collected = collectMarkdownFiles(target)
  for (const file of collected) {
    files.add(file)
  }
}

let changedCount = 0
for (const file of Array.from(files).sort()) {
  if (fixFile(file)) {
    changedCount += 1
    console.log(`fixed: ${file}`)
  }
}

console.log(`done: ${changedCount}/${files.size} file(s) updated`)
