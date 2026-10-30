// English text for the checks in auditoria.json, keyed by the Portuguese title (the JSON is generated in Portuguese).
export const CHECAGENS_EN: Record<string, { titulo: string; resultado: string; nota: string }> = {
  'Soma dos boletins = total oficial, por zona eleitoral': {
    titulo: 'Sum of the reports = official total, per electoral zone',
    resultado: '0 differences in 12,584 zones',
    nota: "For Lula and Flávio, in both rounds, the sum of every section in each zone is identical to the TSE's official per-zone file. (81 overseas “zones” with no voters appear only in the official file, with 0 votes.)",
  },
  'Aptos = comparecimento + abstenções': {
    titulo: 'Registered voters = turnout + abstentions',
    resultado: '0 differences',
    nota: 'Checked on every line of every report.',
  },
  'Mais votantes do que eleitores aptos': {
    titulo: 'More voters than registered voters',
    resultado: '0 sections',
    nota: 'No section has turnout above its number of registered voters.',
  },
  'Votos registrados = comparecimento': {
    titulo: 'Votes recorded = turnout',
    resultado: '0 sections',
    nota: 'In every section, Lula + Flávio + others + blank + null equals exactly the number of people who voted.',
  },
  'Linhas duplicadas no boletim': {
    titulo: 'Duplicated lines in a report',
    resultado: '0',
    nota: 'No candidate appears twice in the same report.',
  },
  'Votos de candidato fora do arquivo oficial (1º turno)': {
    titulo: 'Votes for a candidate missing from the official file (1st round)',
    resultado: '5,246 votes — Leonardo Avalanche (28)',
    nota: 'A candidate who was on the ballot but whose registration was rejected. The TSE counts these votes as “technical nulls”: the official file has exactly 5,246 technical nulls for President.',
  },
  'Aptos diferentes entre 1º e 2º turno na mesma seção': {
    titulo: 'Different number of registered voters between rounds in the same section',
    resultado: '55,722 sections, national net change 0',
    nota: 'Small changes that cancel out (74,692 moves, zero net). Voters away from home request a transit vote per round, so they can be assigned to a different section in each round. The national number of registered voters is the same in both rounds.',
  },
  'Seção em apenas um turno': {
    titulo: 'Section present in only one round',
    resultado: '1 section — Ciudad Guayana (Venezuela), abroad',
    nota: 'No report in the 1st round; 72 registered voters and 0 voters in the 2nd. Those 72 are exactly the difference between registered voters summed from 1st-round reports and the official total.',
  },
  'Mesma urna em várias seções': {
    titulo: 'Same machine in several sections',
    resultado: '3 machines, all abroad',
    nota: 'Small consulates with no opening/closing time and reports issued in sequence at night: the pattern of paper ballots typed into one machine afterwards by the counting board.',
  },
  'Urna carregada depois da abertura da seção': {
    titulo: 'Machine loaded after the section opened',
    resultado: '2 sections',
    nota: 'The load date of the machine in use is after the 08:00 opening — the pattern of a machine replaced on election day (contingency machine). Verifiable in the machine log, which the TSE also publishes.',
  },
  'Boletim recebido pelo TSE antes de emitido': {
    titulo: 'Report received by the TSE before it was issued',
    resultado: '≈13 sections after adjusting for time zones',
    nota: "Almost all cases come from time zones (abroad, and towns in eastern Mato Grosso that use Brasília time). The rest differ by seconds to minutes: drift of the machine's internal clock.",
  },
}
