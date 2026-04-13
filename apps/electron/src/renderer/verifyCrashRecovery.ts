type VerificationStep = {
  name: string
  passed: boolean
  detail?: string
}

type CommandVerification = {
  prompt: string
  toolName: string
  logSources: string[]
  eventTypes: string[]
}

export type CrashRecoveryVerificationResult = {
  passed: boolean
  steps: VerificationStep[]
  commands: CommandVerification[]
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor<T>(
  label: string,
  resolver: () => T | null | undefined | false,
  timeoutMs = 15_000,
  intervalMs = 50,
): Promise<T> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const value = resolver()
    if (value) {
      return value
    }
    await sleep(intervalMs)
  }

  throw new Error(`Timed out waiting for ${label}.`)
}

function queryText(selector: string): string | null {
  return document.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? null
}

function queryAllText(selector: string): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector))
    .map((element) => element.textContent?.trim() ?? '')
    .filter(Boolean)
}

function setTextareaValue(value: string): void {
  const textarea = document.querySelector<HTMLTextAreaElement>('#prompt')
  if (!textarea) {
    throw new Error('Prompt textarea was not found.')
  }

  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )

  descriptor?.set?.call(textarea, value)
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  textarea.focus()
}

function findButtonByText(selector: string, text: string): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(selector))
    .find((button) => button.textContent?.includes(text)) ?? null
}

async function clickButton(selector: string, label: string): Promise<HTMLButtonElement> {
  const button = await waitFor(label, () => document.querySelector<HTMLButtonElement>(selector))
  button.click()
  return button
}

async function clickButtonByText(selector: string, label: string, text: string): Promise<HTMLButtonElement> {
  const button = await waitFor(label, () => findButtonByText(selector, text))
  button.click()
  return button
}

function readBridgeState(): Promise<string | null> {
  const api = (window as Window & {
    agentApi?: {
      getBridgeState?: () => Promise<string>
    }
  }).agentApi

  if (!api?.getBridgeState) {
    return Promise.resolve(null)
  }

  return api.getBridgeState()
}

async function waitForBridgeState(expected: string, timeoutMs = 15_000): Promise<void> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if ((await readBridgeState()) === expected) {
      return
    }
    await sleep(100)
  }

  throw new Error(`Timed out waiting for bridge state "${expected}".`)
}

async function ensureReadyState(): Promise<void> {
  await waitForBridgeState('ready', 20_000)
  await waitFor(
    'primary composer button',
    () => document.querySelector<HTMLButtonElement>('.composer__btn-group .button--primary'),
    10_000,
  )
  await sleep(250)
}

async function submitPrompt(prompt: string, confirmBash = false): Promise<void> {
  setTextareaValue(prompt)
  const submitButton = await waitFor(
    'submit button',
    () => document.querySelector<HTMLButtonElement>('.composer__btn-group .button--primary'),
  )
  submitButton.click()

  if (!confirmBash) {
    return
  }

  await clickButtonByText(
    '.bash-confirm-dialog__actions .button',
    'bash confirm execute button',
    'Execute',
  )
}

async function waitForRunToSettle(timeoutMs = 25_000): Promise<void> {
  await waitFor(
    'run to settle',
    () => {
      const prompt = document.querySelector<HTMLTextAreaElement>('#prompt')
      const cancelButton = document.querySelector('.composer__btn-group .button--ghost')
      const crashButton = document.querySelector('.composer__btn-group .button--danger')
      if (!prompt || cancelButton || crashButton) {
        return null
      }
      return prompt.disabled ? null : true
    },
    timeoutMs,
  )
  await sleep(250)
}

function recordStep(steps: VerificationStep[], name: string, passed: boolean, detail?: string): void {
  steps.push({ name, passed, detail })
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function inspectCompletedRun(prompt: string, toolName: string): Promise<CommandVerification> {
  await clickButtonByText('.bottom-panel__tab-btn', 'OUTPUT tab', 'OUTPUT')
  await waitFor('log entries', () => {
    const sources = queryAllText('.log-entry__source')
    return sources.length > 0 ? sources : null
  })
  const logSources = Array.from(new Set(queryAllText('.log-entry__source')))

  await clickButtonByText('.bottom-panel__tab-btn', 'TIMELINE tab', 'TIMELINE')
  await waitFor('timeline events', () => {
    const eventTypes = queryAllText('.event-entry__type')
    return eventTypes.length > 0 ? eventTypes : null
  })
  const eventTypes = Array.from(new Set(queryAllText('.event-entry__type')))

  const toolNames = queryAllText('.tool-card__name')
  assert(toolNames.includes(toolName), `Expected tool card "${toolName}" for prompt "${prompt}".`)
  assert(logSources.includes('renderer'), `Expected renderer log source for prompt "${prompt}".`)
  assert(logSources.includes('bridge'), `Expected bridge log source for prompt "${prompt}".`)
  assert(logSources.includes('agent'), `Expected agent log source for prompt "${prompt}".`)
  assert(eventTypes.includes('RUN_STARTED'), `Expected RUN_STARTED event for prompt "${prompt}".`)
  assert(eventTypes.includes('TOOL_CALL_STARTED'), `Expected TOOL_CALL_STARTED event for prompt "${prompt}".`)
  assert(eventTypes.includes('TOOL_CALL_COMPLETED'), `Expected TOOL_CALL_COMPLETED event for prompt "${prompt}".`)
  assert(eventTypes.includes('RUN_COMPLETED'), `Expected RUN_COMPLETED event for prompt "${prompt}".`)

  return { prompt, toolName, logSources, eventTypes }
}

export async function runCrashRecoveryVerification(): Promise<CrashRecoveryVerificationResult> {
  const steps: VerificationStep[] = []
  const commands: CommandVerification[] = []

  try {
    await ensureReadyState()
    recordStep(
      steps,
      'cold-start-ready',
      !queryText('.error-banner'),
      queryText('.error-banner') ? `Unexpected banner: ${queryText('.error-banner')}` : 'Bridge reached ready without residual banner.',
    )
    assert(!queryText('.error-banner'), 'Electron cold start left an unexpected error banner.')

    await submitPrompt('bash: Start-Sleep -Seconds 8', true)
    await waitFor('crash button', () => document.querySelector('.composer__btn-group .button--danger'))
    await clickButton('.composer__btn-group .button--danger', 'debug crash button')

    await waitForBridgeState('reconnecting', 15_000)
    const reconnectingPill = await waitFor(
      'reconnecting bridge pill',
      () => document.querySelector<HTMLElement>('.bridge-pill--reconnecting'),
      15_000,
    )
    const reconnectingWarning = await waitFor(
      'reconnecting composer warning',
      () => queryText('.composer__status--warning'),
      15_000,
    )
    recordStep(
      steps,
      'crash-enters-reconnecting',
      Boolean(reconnectingPill.textContent?.includes('Reconnecting')) &&
        reconnectingWarning.includes('Agent bridge'),
      `pill=${reconnectingPill.textContent?.trim() ?? 'missing'}; warning=${reconnectingWarning}`,
    )

    setTextareaValue('read: package.json')
    await waitFor(
      'reconnecting submit warning',
      () => queryText('.composer__status--warning'),
      10_000,
    )
    let submitButtonDisabledDuringReconnect = false
    try {
      await waitFor(
        'disabled submit button during reconnect',
        () => {
          const submitButton = document.querySelector<HTMLButtonElement>('.composer__btn-group .button--primary')
          return submitButton?.disabled ? true : null
        },
        3_000,
      )
      submitButtonDisabledDuringReconnect = true
    } catch {
      submitButtonDisabledDuringReconnect = false
    }

    const submitButtonDuringReconnect = await waitFor(
      'submit button during reconnect',
      () => document.querySelector<HTMLButtonElement>('.composer__btn-group .button--primary'),
      10_000,
    )
    const messageCountBeforeBlockedSubmit = document.querySelectorAll('.message').length
    submitButtonDuringReconnect.click()
    await sleep(250)
    const messageCountAfterBlockedSubmit = document.querySelectorAll('.message').length
    recordStep(
      steps,
      'reconnecting-blocks-submit',
      submitButtonDisabledDuringReconnect && messageCountAfterBlockedSubmit === messageCountBeforeBlockedSubmit,
      `disabled=${submitButtonDisabledDuringReconnect}; messages=${messageCountBeforeBlockedSubmit}->${messageCountAfterBlockedSubmit}`,
    )
    assert(submitButtonDisabledDuringReconnect, 'Submit button should be disabled while bridge is reconnecting.')
    assert(
      messageCountAfterBlockedSubmit === messageCountBeforeBlockedSubmit,
      'A new run started while the bridge was reconnecting.',
    )

    await waitForBridgeState('ready', 20_000)
    await waitFor(
      'reconnecting warning to clear',
      () => (!document.querySelector('.bridge-pill--reconnecting') && !document.querySelector('.composer__status--warning') ? true : null),
      20_000,
    )
    const residualBanner = queryText('.error-banner')
    recordStep(
      steps,
      'ready-clears-transient-errors',
      !residualBanner,
      residualBanner ? `Residual banner: ${residualBanner}` : 'No residual banner after recovery.',
    )
    assert(!residualBanner, `Residual error banner remained after recovery: ${residualBanner}`)

    await submitPrompt('read: package.json')
    await waitForRunToSettle()
    commands.push(await inspectCompletedRun('read: package.json', 'read'))
    recordStep(steps, 'post-recovery-read', true, 'read completed with renderer/bridge/agent logs and terminal events.')

    await submitPrompt('grep: AgentBridge apps/electron')
    await waitForRunToSettle()
    commands.push(await inspectCompletedRun('grep: AgentBridge apps/electron', 'grep'))
    recordStep(steps, 'post-recovery-grep', true, 'grep completed with renderer/bridge/agent logs and terminal events.')

    await submitPrompt('bash: Get-Location', true)
    await waitForRunToSettle()
    commands.push(await inspectCompletedRun('bash: Get-Location', 'bash'))
    recordStep(steps, 'post-recovery-bash', true, 'bash completed with renderer/bridge/agent logs and terminal events.')

    return {
      passed: steps.every((step) => step.passed),
      steps,
      commands,
    }
  } catch (error) {
    recordStep(
      steps,
      'verification-error',
      false,
      error instanceof Error ? error.message : String(error),
    )

    return {
      passed: false,
      steps,
      commands,
    }
  }
}
