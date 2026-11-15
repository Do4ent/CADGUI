import './recoveryBanner.css';
export type RecoveryBannerProps={message:string|null;canResume:boolean;onResume:()=>void};
export function RecoveryBanner({message,canResume,onResume}:RecoveryBannerProps){
 if(!message)return null;
 return <div role="alert" className="recovery-banner"><span>{message}</span>{canResume&&<button type="button" onClick={onResume} title="Сохранить исходные записи в отдельный архив браузера и включить автосохранение текущих вкладок">Возобновить автосохранение</button>}</div>;
}
