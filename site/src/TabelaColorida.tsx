import { colorirTexto } from './colorNum'

const thClassName = 'py-2.5 pl-4 text-right text-sm font-medium first:pl-0 first:text-left'
const tdClassName = 'py-2.5 pl-4 text-right first:pl-0 first:text-left'

export function TabelaColorida({ cabecalho, linhas, rodape }: { cabecalho: string[]; linhas: string[][]; rodape?: string[] }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="num w-full min-w-[460px] text-[15px]">
        <thead className="border-b border-linha text-suave">
          <tr>
            {cabecalho.map((colTitle) => (
              <th key={colTitle} className={thClassName}>
                {colorirTexto(colTitle)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-linha">
          {linhas.map((cells, rowIdx) => (
            <tr key={rowIdx}>
              {cells.map((cellText, colIdx) => (
                <td key={colIdx} className={tdClassName}>
                  {colorirTexto(cellText)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {rodape && (
          <tfoot className="border-t-2 border-tinta font-semibold">
            <tr>
              {rodape.map((cellText, colIdx) => (
                <td key={colIdx} className={tdClassName}>
                  {colorirTexto(cellText)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
