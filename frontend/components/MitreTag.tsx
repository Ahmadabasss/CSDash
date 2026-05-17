const TECHNIQUE_NAMES: Record<string, string> = {
  'T1059':     'Command and Scripting Interpreter',
  'T1059.001': 'PowerShell',
  'T1078':     'Valid Accounts',
  'T1486':     'Data Encrypted for Impact',
  'T1190':     'Exploit Public-Facing Application',
  'T1110':     'Brute Force',
  'T1566':     'Phishing',
  'T1204':     'User Execution',
  'T1055':     'Process Injection',
  'T1021':     'Remote Services',
  'T1003':     'OS Credential Dumping',
  'T1083':     'File and Directory Discovery',
  'T1567':     'Exfiltration Over Web Service',
  'T1610':     'Deploy Container',
  'T1098':     'Account Manipulation',
}

export default function MitreTag({ technique }: { technique: string }) {
  const name = TECHNIQUE_NAMES[technique]
  return (
    <span
      title={name ? `${technique} — ${name}` : technique}
      className="inline-block rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-300 ring-1 ring-slate-700 cursor-default"
    >
      {technique}
    </span>
  )
}
