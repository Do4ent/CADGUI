import {Dialog} from '../components/dialog/Dialog';
import type {ExactBody} from '../kernel/types';
import {buildAssemblyBom, exportAssemblyBomCsv} from './assemblyBom';
import type {AssemblyGroup} from './assemblyHierarchy';
import type {AssemblyInstance} from './assemblyInstances';
import './assemblyBom.css';

interface Props {
  instances: readonly AssemblyInstance[];
  groups: readonly AssemblyGroup[];
  bodies: readonly ExactBody[];
  onClose: () => void;
}

export function AssemblyBomDialog({instances, groups, bodies, onClose}: Props) {
  const rows = buildAssemblyBom(instances, groups, bodies);
  const download = () => {
    const blob = new Blob([exportAssemblyBomCsv(rows)], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'assembly-bom.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <Dialog open title="Спецификация сборки" onConfirm={download} onCancel={onClose}
    confirmLabel="Скачать CSV" cancelLabel="Закрыть" confirmDisabled={!rows.length}>
    {rows.length ? <div className="assembly-bom-scroll" role="region" aria-label="Таблица спецификации" tabIndex={0}>
      <table className="assembly-bom-table" aria-label="Детали сборки">
        <thead><tr><th scope="col">Деталь</th><th scope="col">Вхождения</th><th scope="col">Размещение</th><th scope="col">Состояние</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.sourceBodyId}>
          <th scope="row">
            {row.name}
            <small>{row.sourceBodyId}</small>
          </th>
          <td className="assembly-bom-quantity">{row.quantity}</td>
          <td><ul>{row.placements.map((placement, index) => <li key={index}>
            {placement.path.length ? placement.path.join(' / ') : 'Корень сборки'}
            <span className="assembly-bom-placement-quantity"> × {placement.quantity}</span>
          </li>)}</ul></td>
          <td>{row.available ? 'Доступно' : 'Исходное тело недоступно'}</td>
        </tr>)}</tbody>
      </table>
    </div> : <p role="status">В сборке пока нет вхождений.</p>}
  </Dialog>;
}
