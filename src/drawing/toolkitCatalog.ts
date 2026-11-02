import type {TechnicalIconKind} from '../components/icons/TechnicalIcon';

/** Input categories are editor hints, not a substitute for operation validation. */
export type DrawingCommandInputKind = 'none'|'text'|'number'|'choice'|'position'|'style'|'field'|'table'|'leader'|'search'|'template'|'file'|'diagnostic'|'export';
export type DrawingCommand = {
 readonly id: string;
 readonly label: string;
 readonly groupId: string;
 readonly description: string;
 readonly phase: 'A'|'B'|'C';
 readonly requiresSelection: boolean;
 readonly inputKind: DrawingCommandInputKind;
 readonly icon: TechnicalIconKind;
 /** Missing external capability; UI must explain this rather than simulate success. */
 readonly unavailableReason?: string;
 /** Runtime adapter requirement, resolved by the integrator rather than catalog guesses. */
 readonly capability?: 'cad-exchange'|'font-outlines'|'shx-recognition'|'ocr'|'recognition-review';
 readonly capabilityNote?: string;
};
export type DrawingCommandGroup = {
 readonly id: string;
 readonly label: string;
 readonly commands: readonly DrawingCommand[];
};

/** Stable IDs mirror the research catalog; registration alone is not implementation. */
export const drawingCommands: readonly DrawingCommand[] = [
  {"id": "TXT-001", "label": "Однострочный текст", "groupId": "G01", "description": "Короткая подпись с одной точкой вставки.", "phase": "A", "requiresSelection": false, "inputKind": "text", "icon": "profile"},
  {"id": "TXT-002", "label": "Многострочный текст", "groupId": "G01", "description": "Один редактируемый блок с несколькими абзацами.", "phase": "A", "requiresSelection": false, "inputKind": "text", "icon": "profile"},
  {"id": "TXT-003", "label": "Редактор на листе", "groupId": "G01", "description": "Двойной щелчок открывает содержимое без потери привязки к листу.", "phase": "A", "requiresSelection": true, "inputKind": "text", "icon": "profile"},
  {"id": "TXT-004", "label": "Текстовый контейнер", "groupId": "G01", "description": "Фиксируемая ширина, переносы и явный режим свободной ширины.", "phase": "A", "requiresSelection": true, "inputKind": "choice", "icon": "profile"},
  {"id": "TXT-005", "label": "Заметка с выноской", "groupId": "G01", "description": "Текст и линия выноски сохраняются как связанная аннотация.", "phase": "A", "requiresSelection": false, "inputKind": "leader", "icon": "profile"},
  {"id": "TXT-006", "label": "Флаг или рамка примечания", "groupId": "G01", "description": "Пункт/заметка оформляется выбранной рамкой без превращения смысла в набор линий.", "phase": "B", "requiresSelection": true, "inputKind": "choice", "icon": "profile"},
  {"id": "TXT-007", "label": "Текст таблицы", "groupId": "G01", "description": "Редактируемые ячейки с собственными отступами и выравниванием; отдельная табличная сущность.", "phase": "B", "requiresSelection": false, "inputKind": "table", "icon": "profile"},
  {"id": "TXT-008", "label": "Текст основной надписи", "groupId": "G01", "description": "Редактирование полей шаблона штампа без разрыва его структуры.", "phase": "B", "requiresSelection": false, "inputKind": "template", "icon": "profile"},
  {"id": "TXT-009", "label": "Выбор шрифта", "groupId": "G02", "description": "Семейство/начертание; штриховые шрифты только при наличии соответствующего движка.", "phase": "A", "requiresSelection": false, "inputKind": "style", "icon": "length"},
  {"id": "TXT-010", "label": "Высота текста", "groupId": "G02", "description": "Размер задаётся физическими единицами чертежа/бумаги с явной системой отсчёта.", "phase": "A", "requiresSelection": true, "inputKind": "number", "icon": "length"},
  {"id": "TXT-011", "label": "Жирный и курсив", "groupId": "G02", "description": "Форматирование выделенного фрагмента в пределах поддерживаемого шрифта.", "phase": "A", "requiresSelection": true, "inputKind": "none", "icon": "length"},
  {"id": "TXT-012", "label": "Подчёркивание, надчёркивание, зачёркивание", "groupId": "G02", "description": "Независимые оформления фрагментов; не заменять ими семантику допусков.", "phase": "A", "requiresSelection": true, "inputKind": "none", "icon": "length"},
  {"id": "TXT-013", "label": "Цвет и начертание фрагмента", "groupId": "G02", "description": "Разные фрагменты одного блока могут иметь собственное оформление.", "phase": "A", "requiresSelection": true, "inputKind": "none", "icon": "length"},
  {"id": "TXT-014", "label": "Коэффициент ширины", "groupId": "G02", "description": "Сжатие/растяжение символов отдельно от высоты, с предупреждением о нарушении принятого стиля.", "phase": "B", "requiresSelection": true, "inputKind": "number", "icon": "length"},
  {"id": "TXT-015", "label": "Наклон символов", "groupId": "G02", "description": "Угол наклона символов отдельно от поворота текстового объекта.", "phase": "B", "requiresSelection": true, "inputKind": "number", "icon": "length"},
  {"id": "TXT-016", "label": "Межсимвольные интервалы", "groupId": "G02", "description": "Настройка интервалов там, где это поддерживает выбранный рендерер.", "phase": "B", "requiresSelection": true, "inputKind": "number", "icon": "length"},
  {"id": "TXT-017", "label": "Вертикальное направление письма", "groupId": "G02", "description": "Отдельно от поворота блока на 90°; зависит от возможностей шрифта и shaping.", "phase": "C", "requiresSelection": true, "inputKind": "none", "icon": "length"},
  {"id": "TXT-018", "label": "Якорь текста", "groupId": "G03", "description": "Горизонтальный/вертикальный якорь блока и положение базовой линии различаются явно.", "phase": "A", "requiresSelection": true, "inputKind": "choice", "icon": "direction"},
  {"id": "TXT-019", "label": "Выравнивание абзаца", "groupId": "G03", "description": "По левому/правому краю, центру; по ширине — только при поддержке layout.", "phase": "A", "requiresSelection": true, "inputKind": "choice", "icon": "direction"},
  {"id": "TXT-020", "label": "Межстрочный интервал", "groupId": "G03", "description": "Множитель, минимальный или точный интервал с единицами.", "phase": "A", "requiresSelection": true, "inputKind": "number", "icon": "direction"},
  {"id": "TXT-021", "label": "Интервалы абзацев", "groupId": "G03", "description": "Отступы перед/после абзаца не заменяются пустыми строками.", "phase": "B", "requiresSelection": true, "inputKind": "number", "icon": "direction"},
  {"id": "TXT-022", "label": "Табуляция и отступы", "groupId": "G03", "description": "Позиции табуляции, первая строка и висячий отступ.", "phase": "B", "requiresSelection": true, "inputKind": "choice", "icon": "direction"},
  {"id": "TXT-023", "label": "Списки", "groupId": "G03", "description": "Маркированные, числовые и буквенные списки; продолжить/начать нумерацию заново.", "phase": "A", "requiresSelection": true, "inputKind": "choice", "icon": "direction"},
  {"id": "TXT-024", "label": "Колонки", "groupId": "G03", "description": "Заданное число колонок или динамическая компоновка с контролем переполнения.", "phase": "C", "requiresSelection": true, "inputKind": "choice", "icon": "direction"},
  {"id": "TXT-025", "label": "Управляемые разрывы", "groupId": "G03", "description": "Разрыв строки/абзаца, неразрывный пробел; ручной разрыв колонки при её поддержке.", "phase": "B", "requiresSelection": true, "inputKind": "text", "icon": "direction"},
  {"id": "TXT-026", "label": "Точная точка вставки", "groupId": "G04", "description": "Координаты XY относительно листа/вида, привязки и шаг перемещения.", "phase": "A", "requiresSelection": true, "inputKind": "position", "icon": "angle"},
  {"id": "TXT-027", "label": "Поворот блока", "groupId": "G04", "description": "Угол относительно листа; ограничения выносок показываются явно.", "phase": "A", "requiresSelection": true, "inputKind": "number", "icon": "angle"},
  {"id": "TXT-028", "label": "По базовой линии или ребру", "groupId": "G04", "description": "Ориентация и размещение относительно опорной геометрии при доступных устойчивых ссылках.", "phase": "B", "requiresSelection": true, "inputKind": "position", "icon": "angle"},
  {"id": "TXT-029", "label": "Вписать между двумя точками", "groupId": "G04", "description": "Выбор режима изменения ширины и/или высоты; исходные параметры доступны до подтверждения.", "phase": "B", "requiresSelection": true, "inputKind": "position", "icon": "angle"},
  {"id": "TXT-030", "label": "Выровнять несколько блоков", "groupId": "G04", "description": "Общий левый/правый край, центр или базовая линия.", "phase": "B", "requiresSelection": true, "inputKind": "position", "icon": "angle"},
  {"id": "TXT-031", "label": "Равномерно распределить", "groupId": "G04", "description": "Задать промежутки между выбранными блоками одной транзакцией.", "phase": "B", "requiresSelection": true, "inputKind": "number", "icon": "angle"},
  {"id": "TXT-032", "label": "Текст по дуге", "groupId": "G04", "description": "Радиус, сторона дуги и направление; расширение на произвольную кривую требует отдельного layout.", "phase": "C", "requiresSelection": true, "inputKind": "number", "icon": "angle"},
  {"id": "TXT-033", "label": "Зеркалирование и читаемость", "groupId": "G04", "description": "Явно выбирать зеркальные глифы или сохранение читаемого текста при отражении геометрии.", "phase": "B", "requiresSelection": true, "inputKind": "position", "icon": "angle"},
  {"id": "TXT-034", "label": "Менеджер стилей", "groupId": "G05", "description": "Создать, изменить, дублировать и переименовать именованный стиль.", "phase": "A", "requiresSelection": false, "inputKind": "style", "icon": "material"},
  {"id": "TXT-035", "label": "Наследование и переопределения", "groupId": "G05", "description": "Показывать, что взято из стиля, а что изменено у объекта/фрагмента.", "phase": "A", "requiresSelection": true, "inputKind": "none", "icon": "material"},
  {"id": "TXT-036", "label": "Копировать форматирование", "groupId": "G05", "description": "Перенести оформление без замены содержания и живых полей.", "phase": "B", "requiresSelection": true, "inputKind": "none", "icon": "material"},
  {"id": "TXT-037", "label": "Сбросить к стилю", "groupId": "G05", "description": "Удалить локальные переопределения с предварительным просмотром результата.", "phase": "B", "requiresSelection": true, "inputKind": "none", "icon": "material"},
  {"id": "TXT-038", "label": "Профили ГОСТ/ISO/предприятия", "groupId": "G05", "description": "Наборы настраиваемых стилей; профиль сам по себе не означает нормативную сертификацию.", "phase": "B", "requiresSelection": false, "inputKind": "style", "icon": "material"},
  {"id": "TXT-039", "label": "Бумажный и аннотативный масштаб", "groupId": "G05", "description": "Согласовать читаемую высоту на печати с масштабом вида; не менять содержание текста.", "phase": "B", "requiresSelection": true, "inputKind": "number", "icon": "material"},
  {"id": "TXT-040", "label": "Слой и печатные свойства", "groupId": "G05", "description": "Отдельно хранить экранный цвет, слой, видимость и политику печати.", "phase": "B", "requiresSelection": true, "inputKind": "style", "icon": "material"},
  {"id": "TXT-041", "label": "Политика подстановки шрифтов", "groupId": "G05", "description": "Показать отсутствующий шрифт и выбранную замену, сохранив исходную ссылку.", "phase": "A", "requiresSelection": false, "inputKind": "none", "icon": "material"},
  {"id": "TXT-042", "label": "Фоновая маска и рамка", "groupId": "G05", "description": "Цвет фона, поля маски, рамка и порядок отрисовки без удаления нижележащей геометрии.", "phase": "A", "requiresSelection": true, "inputKind": "style", "icon": "material"},
  {"id": "TXT-043", "label": "Палитра символов", "groupId": "G06", "description": "Диаметр, градусы, ±, микрон и другие Unicode-символы с проверкой покрытия шрифта.", "phase": "A", "requiresSelection": true, "inputKind": "text", "icon": "thickness"},
  {"id": "TXT-044", "label": "Верхний и нижний индекс", "groupId": "G06", "description": "Индексы остаются структурой текста, а не смещёнными отдельными объектами.", "phase": "A", "requiresSelection": true, "inputKind": "none", "icon": "thickness"},
  {"id": "TXT-045", "label": "Дроби", "groupId": "G06", "description": "Горизонтальные/наклонные дроби с редактируемыми числителем и знаменателем.", "phase": "B", "requiresSelection": true, "inputKind": "text", "icon": "thickness"},
  {"id": "TXT-046", "label": "Верхнее/нижнее отклонение", "groupId": "G06", "description": "Структурированная запись отклонений; простой текстовый блок не объявляется размером модели.", "phase": "B", "requiresSelection": true, "inputKind": "text", "icon": "thickness"},
  {"id": "TXT-047", "label": "Префикс/суффикс размера", "groupId": "G06", "description": "Дополнить вычисленное значение, не уничтожая измерение и его связь с геометрией.", "phase": "B", "requiresSelection": true, "inputKind": "text", "icon": "thickness"},
  {"id": "TXT-048", "label": "Геометрические допуски и базы", "groupId": "G06", "description": "Отдельные семантические обозначения с рамками и ссылками; не свободная строка символов.", "phase": "B", "requiresSelection": false, "inputKind": "choice", "icon": "thickness"},
  {"id": "TXT-049", "label": "Сварка и шероховатость", "groupId": "G06", "description": "Специализированные аннотации с проверяемыми полями и библиотекой условных обозначений.", "phase": "B", "requiresSelection": false, "inputKind": "choice", "icon": "thickness"},
  {"id": "TXT-050", "label": "Отверстия, резьба и сгибы", "groupId": "G06", "description": "Автоматические заметки только по реальным данным соответствующих элементов модели.", "phase": "B", "requiresSelection": false, "inputKind": "choice", "icon": "thickness"},
  {"id": "TXT-051", "label": "Ветви выноски", "groupId": "G07", "description": "Добавить/удалить несколько стрелок у одной заметки.", "phase": "B", "requiresSelection": true, "inputKind": "leader", "icon": "direction"},
  {"id": "TXT-052", "label": "Форма выносной линии", "groupId": "G07", "description": "Прямая, ломаная, дуга; сплайн — если реализован геометрический компонент.", "phase": "B", "requiresSelection": true, "inputKind": "leader", "icon": "direction"},
  {"id": "TXT-053", "label": "Стрелка и полка", "groupId": "G07", "description": "Тип/размер наконечника, длина полки и точка присоединения к тексту.", "phase": "A", "requiresSelection": true, "inputKind": "leader", "icon": "direction"},
  {"id": "TXT-054", "label": "Связь с геометрией", "groupId": "G07", "description": "Выноска следует за доступным устойчивым объектом/видом; потеря связи обозначается явно.", "phase": "B", "requiresSelection": true, "inputKind": "leader", "icon": "direction"},
  {"id": "TXT-055", "label": "Перепривязать аннотацию", "groupId": "G07", "description": "Выбрать новую опору для потерянной связи и подтвердить замену.", "phase": "B", "requiresSelection": true, "inputKind": "leader", "icon": "direction"},
  {"id": "TXT-056", "label": "Позиционные обозначения", "groupId": "G07", "description": "Позиция из спецификации отличается от вручную введённого числа.", "phase": "B", "requiresSelection": false, "inputKind": "choice", "icon": "direction"},
  {"id": "TXT-057", "label": "Ключевые и флажковые примечания", "groupId": "G07", "description": "Маркер ссылается на пункт/легенду, а текст пункта редактируется централизованно.", "phase": "B", "requiresSelection": false, "inputKind": "choice", "icon": "direction"},
  {"id": "TXT-058", "label": "Упорядочить выноски", "groupId": "G07", "description": "Выравнивание и интервалы группы выносок без разрыва их привязок.", "phase": "B", "requiresSelection": true, "inputKind": "leader", "icon": "direction"},
  {"id": "TXT-059", "label": "Поля документа и листа", "groupId": "G08", "description": "Обозначение, название, номер листа, автор и другие явно доступные свойства.", "phase": "B", "requiresSelection": false, "inputKind": "field", "icon": "profile"},
  {"id": "TXT-060", "label": "Свойства модели", "groupId": "G08", "description": "Подставлять только существующие данные; отсутствие массы/материала не заменять выдуманным значением.", "phase": "B", "requiresSelection": false, "inputKind": "field", "icon": "profile"},
  {"id": "TXT-061", "label": "Параметры и выражения", "groupId": "G08", "description": "Типизированные ссылки/выражения с ограниченным вычислителем, без исполнения произвольного кода.", "phase": "C", "requiresSelection": false, "inputKind": "field", "icon": "profile"},
  {"id": "TXT-062", "label": "Формат значения", "groupId": "G08", "description": "Единицы, точность и префиксы отделены от исходного значения поля.", "phase": "B", "requiresSelection": true, "inputKind": "field", "icon": "profile"},
  {"id": "TXT-063", "label": "Шаблон основной надписи", "groupId": "G08", "description": "Зоны штампа и привязки полей переиспользуются на листах.", "phase": "B", "requiresSelection": false, "inputKind": "template", "icon": "profile"},
  {"id": "TXT-064", "label": "Ссылки на зоны и листы", "groupId": "G08", "description": "Ссылка хранит идентификатор цели; смена номера листа не превращает её в устаревшую строку.", "phase": "B", "requiresSelection": false, "inputKind": "field", "icon": "profile"},
  {"id": "TXT-065", "label": "Табличные внешние данные", "groupId": "G08", "description": "Связь с CSV/таблицами; Excel — только при наличии реально работающего адаптера.", "phase": "C", "requiresSelection": false, "inputKind": "table", "icon": "profile"},
  {"id": "TXT-066", "label": "Обновить/зафиксировать поле", "groupId": "G08", "description": "Явные действия: обновить, сделать статическим, восстановить связь; показывать потерянный источник.", "phase": "B", "requiresSelection": true, "inputKind": "none", "icon": "profile"},
  {"id": "TXT-067", "label": "Редактор технических требований", "groupId": "G09", "description": "ТТ — отдельный нумерованный документ/блок, а не набор несвязанных надписей.", "phase": "B", "requiresSelection": false, "inputKind": "text", "icon": "material"},
  {"id": "TXT-068", "label": "Размещение ТТ по страницам", "groupId": "G09", "description": "Разбиение и размещение длинных требований без потери последовательности пунктов.", "phase": "B", "requiresSelection": false, "inputKind": "choice", "icon": "material"},
  {"id": "TXT-069", "label": "Словарь типовых фраз", "groupId": "G09", "description": "Вставка утверждённых формулировок с редактируемыми параметрами.", "phase": "B", "requiresSelection": false, "inputKind": "text", "icon": "material"},
  {"id": "TXT-070", "label": "Избранное с полями", "groupId": "G09", "description": "Шаблон текста вместе с ссылками на свойства и правилами оформления.", "phase": "B", "requiresSelection": true, "inputKind": "none", "icon": "material"},
  {"id": "TXT-071", "label": "Шаблоны аннотаций", "groupId": "G09", "description": "Переиспользовать содержание/стиль/выноску; новые объекты получают новые идентификаторы.", "phase": "B", "requiresSelection": false, "inputKind": "template", "icon": "material"},
  {"id": "TXT-072", "label": "Перенести на другой лист", "groupId": "G09", "description": "Явно сохранить, перепривязать или зафиксировать ссылки, если источник недоступен.", "phase": "B", "requiresSelection": true, "inputKind": "position", "icon": "material"},
  {"id": "TXT-073", "label": "Каталог шаблонов", "groupId": "G09", "description": "Категории и имена типовых фраз/избранного; поиск — требование интерфейса BendCore.", "phase": "B", "requiresSelection": false, "inputKind": "template", "icon": "material"},
  {"id": "TXT-074", "label": "Ссылки на пункты ТТ", "groupId": "G09", "description": "Связанные отсылки к пунктам не заменяются копированием текущего номера.", "phase": "B", "requiresSelection": true, "inputKind": "text", "icon": "material"},
  {"id": "TXT-075", "label": "Найти и заменить", "groupId": "G10", "description": "Выделение/лист/документ, регистр и целое слово; шаблоны поиска — отдельный режим.", "phase": "A", "requiresSelection": false, "inputKind": "search", "icon": "preview"},
  {"id": "TXT-076", "label": "Групповое изменение свойств", "groupId": "G10", "description": "Образец: массовая смена стиля; высота/положение и одна undo-транзакция — требования BendCore к расширению операции.", "phase": "B", "requiresSelection": true, "inputKind": "style", "icon": "preview"},
  {"id": "TXT-077", "label": "Смена регистра", "groupId": "G10", "description": "Верхний/нижний регистр и капитализация без разрушения полей.", "phase": "A", "requiresSelection": true, "inputKind": "none", "icon": "preview"},
  {"id": "TXT-078", "label": "Проверка орфографии", "groupId": "G10", "description": "Язык и пользовательский инженерный словарь; не проверять коды/артикулы как обычные слова без настройки.", "phase": "B", "requiresSelection": false, "inputKind": "diagnostic", "icon": "preview"},
  {"id": "TXT-079", "label": "Перенумеровать выбранные позиции", "groupId": "G10", "description": "Предварительный список соответствий; связанные позиции обновляются согласованно.", "phase": "B", "requiresSelection": true, "inputKind": "number", "icon": "preview"},
  {"id": "TXT-080", "label": "Выбор по тексту/свойствам", "groupId": "G10", "description": "Найти объекты по содержимому, стилю или шрифту и передать набор общему selection API.", "phase": "B", "requiresSelection": false, "inputKind": "search", "icon": "preview"},
  {"id": "TXT-081", "label": "Согласование стилей", "groupId": "G10", "description": "Показать конфликтующие стили и overrides, предложить явное объединение вместо тихой замены.", "phase": "B", "requiresSelection": false, "inputKind": "style", "icon": "preview"},
  {"id": "TXT-082", "label": "Проверка связей", "groupId": "G10", "description": "Список сломанных ссылок полей, выносок и штампа с переходом к объекту.", "phase": "B", "requiresSelection": false, "inputKind": "diagnostic", "icon": "preview"},
  {"id": "TXT-083", "label": "Импорт обычного текста", "groupId": "G11", "description": "UTF-8 с явным выбором кодировки при необходимости; переносы сохраняются.", "phase": "A", "requiresSelection": false, "inputKind": "text", "icon": "profile"},
  {"id": "TXT-084", "label": "Вставка без/с оформлением", "groupId": "G11", "description": "Различать обычный текст и безопасный ограниченный rich text; форматирование можно сбросить.", "phase": "A", "requiresSelection": false, "inputKind": "text", "icon": "profile"},
  {"id": "TXT-085", "label": "Объединить строки в блок", "groupId": "G11", "description": "Предварительно показать порядок чтения и возможные изменения интервалов.", "phase": "B", "requiresSelection": true, "inputKind": "none", "icon": "profile"},
  {"id": "TXT-086", "label": "Разбить блок на строки", "groupId": "G11", "description": "Показать потери форматирования и живых полей до подтверждения.", "phase": "B", "requiresSelection": true, "inputKind": "none", "icon": "profile"},
  {"id": "TXT-087", "label": "SVG с редактируемым текстом", "groupId": "G11", "description": "Отдельный export backend; явно указывать, сохраняется ли текст или создаются контуры.", "phase": "B", "requiresSelection": false, "inputKind": "export", "icon": "profile"},
  {"id": "TXT-088", "label": "PDF с поиском текста", "groupId": "G11", "description": "Проверять реальную извлекаемость текста, шрифты и условия встраивания; контуры сами по себе поиска не дают.", "phase": "C", "requiresSelection": false, "inputKind": "export", "icon": "profile"},
  {"id": "TXT-089", "label": "DWG/DXF текст и стили", "groupId": "G11", "description": "Требуется выбранный SDK/адаптер и матрица TEXT/MTEXT/ATTRIB; неподдержанные свойства не теряются молча.", "phase": "C", "requiresSelection": false, "inputKind": "file", "icon": "profile", "capability": "cad-exchange", "capabilityNote": "DWG требует отдельного SDK; DXF доступен только в рамках возможностей установленного адаптера."},
  {"id": "TXT-090", "label": "Текст в контуры при экспорте", "groupId": "G11", "description": "Onshape документирует Explode заметки в полилинии при экспорте. В BendCore нужны предпросмотр и предупреждение о потере текстовой семантики.", "phase": "C", "requiresSelection": false, "inputKind": "export", "icon": "profile", "capability": "font-outlines", "capabilityNote": "Нужны реально доступный шрифт, разрешение на его использование и движок контуров."},
  {"id": "TXT-091", "label": "Восстановить SHX из PDF", "groupId": "G11", "description": "Сопоставление импортированной векторной геометрии со шрифтом; это не OCR растров.", "phase": "C", "requiresSelection": false, "inputKind": "file", "icon": "profile", "capability": "shx-recognition", "capabilityNote": "Нужен движок сопоставления SHX и импортированной геометрии PDF.", "unavailableReason": "Нет движка сопоставления SHX с векторной геометрией PDF."},
  {"id": "TXT-092", "label": "OCR скана", "groupId": "G11", "description": "Отдельный OCR backend с выбором области/языка и ручной проверкой распознанного результата.", "phase": "C", "requiresSelection": false, "inputKind": "file", "icon": "profile", "capability": "ocr", "capabilityNote": "Нужны OCR-движок и доступные языковые данные."},
  {"id": "TXT-093", "label": "Проверить результат распознавания", "groupId": "G11", "description": "Наложить исходник и найденный текст, показать сомнительные символы до замены; исходник сохраняется.", "phase": "C", "requiresSelection": false, "inputKind": "file", "icon": "profile", "capability": "recognition-review", "capabilityNote": "Нужен исходник и результат распознавания для подтверждения пользователем."},
  {"id": "TXT-094", "label": "Переполнение и отсутствующие глифы", "groupId": "G12", "description": "Показывать необработанные символы и выход за контейнер до сохранения/экспорта.", "phase": "A", "requiresSelection": false, "inputKind": "diagnostic", "icon": "preview"},
  {"id": "TXT-095", "label": "Наложения и читаемость", "groupId": "G12", "description": "Обнаруживать пересечения текста с аннотациями и слишком малую печатную высоту; исправления подтверждаются.", "phase": "B", "requiresSelection": false, "inputKind": "diagnostic", "icon": "preview"},
  {"id": "TXT-096", "label": "Отчёт о шрифтах", "groupId": "G12", "description": "Показать используемые/подменённые шрифты, покрытие символов и влияние на переносы.", "phase": "B", "requiresSelection": false, "inputKind": "diagnostic", "icon": "preview"},
  {"id": "TXT-097", "label": "Unicode, кириллица и IME", "groupId": "G12", "description": "Сохранность символов и композиционного ввода при редактировании и повторном открытии.", "phase": "A", "requiresSelection": false, "inputKind": "none", "icon": "preview"},
  {"id": "TXT-098", "label": "Печатный предпросмотр", "groupId": "G12", "description": "Одинаковый текст/единицы на листе и при поддерживаемом экспорте; масштаб интерфейса не меняет высоту на бумаге.", "phase": "A", "requiresSelection": false, "inputKind": "export", "icon": "preview"},
  {"id": "TXT-099", "label": "Отмена и подтверждение", "groupId": "G12", "description": "Черновик не меняет документ. ОК/Apply фиксируют одну undo-транзакцию, Escape отменяет текущий черновик.", "phase": "A", "requiresSelection": false, "inputKind": "none", "icon": "preview"},
  {"id": "TXT-100", "label": "Сравнение текстовых изменений", "groupId": "G12", "description": "Показать изменения содержания и ссылок между сохранёнными ревизиями; требуется подсистема истории.", "phase": "B", "requiresSelection": false, "inputKind": "diagnostic", "icon": "preview"},
  {"id": "TXT-101", "label": "Клавиатура и доступность", "groupId": "G12", "description": "В модальном редакторе Tab/Shift+Tab удерживают фокус; немодальная панель позволяет перейти к листу. После закрытия фокус возвращается инициатору, команды модели заблокированы при вводе.", "phase": "A", "requiresSelection": false, "inputKind": "none", "icon": "preview"},
  {"id": "TXT-102", "label": "RTL и сложные письменности", "groupId": "G12", "description": "Отдельный shaping/bidi backend и тесты порядка чтения, лигатур и сложных глифов; не объявлять готовыми через обычный CSS direction.", "phase": "C", "requiresSelection": false, "inputKind": "none", "icon": "preview"},
];

export const drawingCommandGroups: readonly DrawingCommandGroup[] = [
  {id:"G01",label:"Создание и редактор",commands:drawingCommands.filter(command=>command.groupId==="G01")},
  {id:"G02",label:"Символы текста и шрифты",commands:drawingCommands.filter(command=>command.groupId==="G02")},
  {id:"G03",label:"Абзацы и компоновка",commands:drawingCommands.filter(command=>command.groupId==="G03")},
  {id:"G04",label:"Размещение и преобразования",commands:drawingCommands.filter(command=>command.groupId==="G04")},
  {id:"G05",label:"Стили и оформление чертежа",commands:drawingCommands.filter(command=>command.groupId==="G05")},
  {id:"G06",label:"Инженерный набор",commands:drawingCommands.filter(command=>command.groupId==="G06")},
  {id:"G07",label:"Выноски, позиции и связи",commands:drawingCommands.filter(command=>command.groupId==="G07")},
  {id:"G08",label:"Поля, штамп и данные",commands:drawingCommands.filter(command=>command.groupId==="G08")},
  {id:"G09",label:"Технические требования и переиспользование",commands:drawingCommands.filter(command=>command.groupId==="G09")},
  {id:"G10",label:"Поиск и групповые операции",commands:drawingCommands.filter(command=>command.groupId==="G10")},
  {id:"G11",label:"Импорт, экспорт и преобразования",commands:drawingCommands.filter(command=>command.groupId==="G11")},
  {id:"G12",label:"Контроль качества и удобство",commands:drawingCommands.filter(command=>command.groupId==="G12")},
 ];

const commandById = new Map(drawingCommands.map(command=>[command.id, command]));
/** Unknown IDs are deliberately rejected; there is no fallback command. */
export function getDrawingCommand(id: string): DrawingCommand | undefined {
 return commandById.get(id);
}
