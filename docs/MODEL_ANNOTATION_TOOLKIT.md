# Аннотации в режиме 3D-моделирования: CAD, PMI и MBD

Проверено: **3 ноября 2026 года**. База BendCore: `e5d7d86` (после PR #13). Это исследование и спецификация; команды MNA не зарегистрированы и не реализованы в приложении.

## Охват и метод

Рассмотрены **18 внешних продуктов/семейств**, включая отдельные BIM-примеры. Для каждого указаны проверенный модуль, версия и предел доказательств. Использованы первичные руководства, официальные продуктовые страницы и материалы производителей; коммерческие приложения интерактивно не испытывались. Официальная продуктовая страница слабее воспроизводимого теста конкретного файла и версии. Номер версии в ссылке не означает, что более новый выпуск проверен.

«Все CAD» нельзя достоверно свести в конечную таблицу: существуют сотни нишевых систем и расширений. Здесь охвачены основные подходы; для DraftSight, ZWCAD/MFG, GstarCAD/Mechanical, Cimatron, TopSolid, IronCAD, Alibre, SolidFace, QCAD и LibreCAD самостоятельные 3D PMI-возможности в этом проходе не установлены. Неустановленное не означает отсутствующее. Механическое расширение, роль или платный модуль не приписываются базовому продукту.

FreeCAD рассмотрен по официальному репозиторию документации, архивированному 1 апреля 2026 года: страницы смешивают версии и не доказывают текущий охват релиза. AutoCAD включён с ограниченным доказательством: доступен индексируемый текст официального support article, но full body при открытии недоступен. Другие источники открыты исследователями и проверены по содержанию. Нормативные полные тексты ISO/ASME/AWS/ГОСТ не проверялись.

## Какие инструменты следует различать

| Объект | Назначение | Что он не доказывает |
|---|---|---|
| Управляющий размер эскиза/операции | Меняет параметр и геометрию через solver | Автоматически не становится постоянным 3D PMI |
| Справочный размер модели | Вычисляется по выбранным опорам; может содержать допуск | Не управляет геометрией без отдельной связи |
| Ручная заметка с опорой | Описывает объект или требование | Текст сам не становится измерением |
| Экранная подпись/HUD | Читается независимо от вращения; иногда относится ко всему документу | Экранная позиция не является координатой в модели |
| Знак на плоскости аннотаций | Представляет требование в выбранной ориентации | Положение на плоскости не меняет семантику требования |
| Графический PMI | Отображает рамки, знаки и значения | Не гарантирует машинно-читаемые характеристики и опоры |
| Семантический PMI | Хранит типизированные характеристики, единицы, базы и связи | Сам по себе не подтверждает соответствие изготовленной детали |
| Геометрический 3D Text | Создаёт контуры/грани букв для маркировки, гравировки и т.п. | Это операция моделирования, а не PMI-заметка |
| Аннотация производного документа | Оформляет Drawing/3D Document/сохранённый вид | Не обязательно существует при свободном вращении модели |

MBD — организация геометрии, требований, представлений и контекста выпуска. Набор красивых 3D-подписей не делает приложение MBD-совместимым. Анализ номинальной модели, проверка правил записи и измерительный контроль изготовленной детали — три разных проверки.

## Сравнение CAD

Статусы: **documented-3d** — документировано авторство модельных аннотаций; **documented-limited** — подтверждён ограниченный набор; **limited-evidence/not-established** — недостаточно данных о самостоятельном 3D PMI; **view/document-bound** — инструмент привязан к виду/документу. Статусы не являются рейтингом качества или сертификацией.

| Система и проверенный модуль | Подтверждённые инструменты | Ограничения | Источники |
|---|---|---|---|
| **NX** — June 2023; PMI guide 2025 (documented-3d) | Размеры, GTOL/базы, заметки, правила, плоскости, импорт Convert PMI. | Импорт сопровождается предупреждениями; охват любого формата не доказан. | NX-MBD, NX-PMI |
| **Creo** — Parametric 12 (documented-3d) | Размеры/GTOL/символы/заметки; Semantic Query, DRF; combined states. | Управляющий размер и оформление различаются; семантический запрос требует семантической опоры. | CREO-MBD, CREO-QUERY, CREO-VIEWS |
| **CATIA** — V5 FT1; отдельно 3DEXPERIENCE TAD (documented-3d) | Аннотации и плоскости; в TAD — advisor и captures. | FT1 прямо имеет неполную семантическую ассоциативность. Роли и поколения не складываются в одну лицензию. | CATIA-FT1, CATIA-TAD |
| **SOLIDWORKS** — 2026 DimXpert; отдельный MBD (documented-3d) | Размеры/допуски модели, автоматизация; MBD — виды, 3D PDF/STEP 242. | Базовые аннотации доступны в Standard; MBD — отдельный продукт. Экспорт не доказывает lossless round-trip. | SW-DIMX, SW-MBD, SW-TOOLS |
| **Solid Edge** — MBD / Advanced PMI, datasheets 09/2024 (documented-3d) | 3D PDF, виды/шаблоны; Advanced PMI — авторазмеры, проверки определённости, заметки. | Публикация MBD и автоматизация Advanced PMI — разные наборы возможностей; STEP-семантика не установлена. | SE-MBD, SE-ADV |
| **Inventor** — 3D Annotation 2024–2026 (documented-3d) | Деталь/сборка, design views, cross-highlighting, сварка, targets, параметры текста. | Tolerance Feature/Advisor — для детали; единицы 3DA от Active Standard. Tolerance Analysis — отдельная задача. | INV-3DA, INV-WELD, INV-2026 |
| **Onshape** — Part Studio MBD, текущая справка (documented-3d) | Driving/driven annotations, datum/GTOL/weld, Inspection table, CSV/STEP. | Опоры MBD — faces; нельзя произвольно заменить edges/vertices. Определения внутри part/composite; derived меняются в источнике, closed composite STEP ограничен. Тариф по справке не установлен. | ON-MBD, ON-TABLE |
| **Fusion** — Design / Manufacturing Extension, текущая справка (documented-limited) | PMI Authoring; явно Note и Hole/Thread Note, применение PMI в CAM inspection. | Полный собственный GD&T-editor не доказан; автоматический перенос size tolerances в inspection — linear/diameter. Не путать с Drawing. | FUS-DESIGN, FUS-MFG, FUS-INSPECT |
| **КОМПАС-3D** — v24 (documented-3d) | Размеры модели, производные размеры, GD&T/базы/шероховатость, выноски, ТТ, ориентации. | Плоскость может задавать проекционный размер; ТТ — overlay. Потеря источника может оставить графику на месте. | K-DIMS, K-PLANE, K-ANN, K-TT, K-VIEWS |
| **T-FLEX CAD** — v17 и v18, различать (documented-3d) | Нативные 3D-размеры/выноски/GD&T/базы/шероховатость/сварка; опоры, плоскости и сцены. | Экранная ориентация надписи не обещает её для всех размеров. Связь размещённых ТТ v17/v18 различается. | TF-ANN, TF-DIM, TF-ORIENT, TF-SCENE, TF-TT17, TF-TT18 |
| **FreeCAD** — Draft; архивированная документация нескольких версий (documented-limited) | 3D-view Dimension и Label, опоры и свойства, World/Screen. | Не TechDraw-лист. Угловой Draft Dimension не параметрический по источнику. Это не доказательство полной GD&T/семантической PMI. | FC-DIM, FC-LABEL |
| **Rhino** — 8 + developer guide (documented-limited) | Text, Leader, размеры, плоскости, стили, читаемость, маски и scale. | Плоские annotation objects в 3D-сцене не равны семантическому GD&T; история ассоциативности ко всем исходным граням не установлена. | RHINO-ANN, RHINO-STYLE |
| **SketchUp** — Текущая справка (documented-limited) | Экранный текст, связанные выноски, динамические размеры; отдельный 3D Text. | 3D Text — геометрия, не аннотация. Из наличия размеров не следует семантический PMI. | SKETCHUP |
| **AutoCAD** — Support article, версия не задана (limited-evidence) | Размеры 3D-объекта с учётом UCS. | Это model-space оформление; инженерная семантика PMI и охват Mechanical не подтверждены. Full body источника недоступен. | AUTOCAD |
| **BricsCAD** — Проверена справка UCS (limited-evidence) | Пространственные UCS и плоскость создания объектов. | Самостоятельное авторство семантического PMI в 3D этим источником не установлено; не вывод об отсутствии. | BRICS-UCS |
| **nanoCAD** — Компонент 3D, страница без версии (not-established) | Подтверждены моделирование и ассоциативная 2D-документация. | Нативная семантическая 3D PMI-подсистема по проверенным страницам не установлена. | NANO |
| **Revit** — 2024; отдельная BIM-категория (view-bound) | Tags/keynotes в сохранённом locked ортографическом 3D-виде. | Не свободное размещение PMI при orbit. Perspective/default и некоторые категории tags исключены; новая ориентация может удалить tags. | REVIT |
| **ARCHICAD** — 24; отдельная BIM-категория (document-bound) | 3D Document с размерами/подписями/2D-элементами. | Аннотируется производный документ, не произвольная вращаемая 3D-сцена. | ARCHICAD |

## Общие подходы и выводы для интерфейса

**Плоскость и опора — разные поля.** В Rhino аннотационный объект имеет плоскость, положение и стиль. В Creo, CATIA и NX к этому добавляются семантические ссылки и управление представлениями. Выбор новой плоскости не должен незаметно заменять источник размера. Для projected-distance необходимо явно показывать проекционную метрику; пример КОМПАС доказывает, что «размер в 3D-окне» не всегда равен пространственному расстоянию.

**Сохранённый вид — часть данных представления.** Creo combined states могут включать ориентацию, сечения, взрыв, упрощение и собственную видимость. T-FLEX scenes и SOLIDWORKS 3D views решают близкую задачу, но их схемы не тождественны. Камера, плоскости, набор требований и состояние сборки должны храниться раздельно. В Revit locked-view tags — иной подход: при orbit они скрываются, а сохранение новой ориентации может удалить прежние tags. Его нельзя копировать как свободный пространственный PMI.

**Семантика важнее красивой рамки.** Creo Semantic Query показывает зависимые поверхности/базы; CATIA FT1 прямо ограничивает полноту семантической ассоциативности. Поэтому нельзя объявлять «полный PMI» по одному наличию FCF или выноски. Нужны независимые capability flags для graphic/semantic PMI и типов опор.

**Таблица требований дополняет сцену.** Onshape Inspection table связывает выбранную деталь с характеристиками и аннотациями, поддерживает cross-highlighting и CSV. Его ограничения по faces, derived и closed composite необходимо сохранять при обмене. Отсутствие в отдельном описании какого-либо инструмента не является доказательством его отсутствия в продукте.

**Актуальные расширения проверяются отдельно.** Fusion уже заявляет PMI Authoring в расширениях; подтверждены Note/Hole-Thread Note и использование допусков в CAM inspection. Это не основание приписывать ему весь набор GD&T-authoring из NX или Creo. SOLIDWORKS имеет базовые аннотации вне MBD, а публикация/организация MBD зависит от отдельного продукта. Solid Edge MBD и Advanced PMI также нельзя считать одним модулем.

**3D-подпись и технические требования документа могут жить по-разному.** В КОМПАС ТТ показаны поверх сцены; в T-FLEX семантика связей размещённых ТТ менялась между v17 и v18. В SketchUp геометрический 3D Text принципиально отличается от screen/leader text. В FreeCAD Draft-аннотации существуют в 3D-виде; TechDraw остаётся чертёжным видом даже при измерении 3D-геометрии.

**Автоматизация должна показывать покрытие.** Auto dimension/auto tolerance требуют узнаваемых геометрических характеристик и проверенного набора правил. Подпись «автоматически» не подтверждает ни полноту определения детали, ни технологическую пригодность. Недо-/переопределённость допуска, противоречие правил и фактический брак — разные результаты.

## Текущее состояние BendCore

В режиме моделирования отдельной подсистемы аннотаций пока нет. Проверка кода базовой версии:

- `src/CustomRibbon.tsx:28` и `:35`: Dimension/Measure отмечены `demo:true`; обработчик `:64` пишет сообщение о неподключённом CAD-ядре. Это не рабочие измерения.
- `src/CommandRegistry.ts:3`: нет зарегистрированных команд 3D-аннотаций/измерений; неизвестные команды отключаются.
- `src/main.tsx:44` и `:86`: сцена рисует примитивы/рёбра, Grid/камеры/гизма; нет слоя текста, выносок и PMI. Выбор передаёт ID компонента, не устойчивую грань/ребро/вершину.
- `src/documents/documentModel.ts:4`: CadItem хранит id/name/kind/pos/size/color/visible/group, без типизированных модельных аннотаций, топологии и наборов видов.
- `src/editor/useEditorDocuments.ts:7`: история сцены и сохранение документов есть, но модель аннотаций существует в Drawing отдельно.
- `src/drawing/model.ts:55` и `src/drawing/operations.ts:116`: подстановка pos/size в текст листа и XY-выноска модели не являются 3D PMI.
- `src/drawing/dimensions/catalog.ts`: истинная 3D-топология/метрика, PMI и STEP AP242 явно ограничены; `engine.ts:9` работает с XY, не с пространственными опорами.

Значения pos/size прототипных примитивов можно использовать как явно подписанные свойства, но нельзя выдавать их за точные B-rep-измерения произвольной детали. Существующие каталоги TXT/TBL/DIM/SYM относятся главным образом к Drawing; их нельзя просто включить в 3D без новой модели опор, плоскостей и представлений.

## Предлагаемый каталог BendCore

MNA — отдельное пространство идентификаторов. Все позиции ниже **planned**, `runtimeIntegrated:false`. Источники группы дают аналоги и архитектурное основание, а не доказательство наличия каждой предлагаемой команды у каждого производителя. Покрытия, термообработка, JT/QIF и отдельные проверки включены как требования/интеграционные направления BendCore, не как подтверждённые возможности всей сравнительной таблицы.

Этапы: **A** — собственные данные/заметки/редактирование; **B** — представления, связи и измерения через подтверждённые геометрические адаптеры; **C** — типизированный семантический PMI, нормативные и обменные адаптеры. У отдельных команд этап отличается от соседних; базовое сохранение и Undo не ждут STEP/PMI.

### MG01 — Заметки и подписи модели

Источники: FC-LABEL, SKETCHUP, NX-PMI.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-001 | Создать пространственную заметку | A | model-annotation-schema |
| MNA-002 | Создать подпись компонента | A | model-annotation-schema |
| MNA-003 | Создать экранную заметку документа | A | model-annotation-schema |
| MNA-004 | Создать заметку со ссылкой на объект | A | model-annotation-schema |
| MNA-005 | Выбрать режим World/Screen | A | model-annotation-schema |
| MNA-006 | Редактировать многострочный текст | A | model-annotation-schema |
| MNA-007 | Превратить геометрический текст в отдельную задачу моделирования | C | text-to-geometry-adapter |

### MG02 — Опоры и контекст сборки

Источники: TF-DIM, ON-TABLE, CREO-QUERY.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-008 | Привязать к компоненту | B | reference-adapter |
| MNA-009 | Привязать к грани | B | reference-adapter |
| MNA-010 | Привязать к ребру | B | reference-adapter |
| MNA-011 | Привязать к вершине | B | reference-adapter |
| MNA-012 | Привязать к оси или плоскости | B | reference-adapter |
| MNA-013 | Выбрать экземпляр в сборке | B | reference-adapter |
| MNA-014 | Добавить несколько опор | B | reference-adapter |
| MNA-015 | Показать источник и его контекст | B | reference-adapter |

### MG03 — Плоскости и ориентация

Источники: RHINO-ANN, TF-ORIENT, K-PLANE, NX-PMI.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-016 | Выбрать плоскость аннотации | A | annotation-frame |
| MNA-017 | Задать локальную систему координат | A | annotation-frame |
| MNA-018 | Разместить параллельно грани | A | annotation-frame |
| MNA-019 | Разместить в плоскости грани | A | annotation-frame |
| MNA-020 | Повернуть текст в плоскости | A | annotation-frame |
| MNA-021 | Ориентировать надпись к экрану | A | annotation-frame |
| MNA-022 | Перенести на другую плоскость без изменения требования | A | annotation-frame |
| MNA-023 | Показать тип измерения: пространственный или проекционный | A | annotation-frame |

### MG04 — Размеры модели и измерения

Источники: SW-DIMX, K-DIMS, K-PLANE, TF-DIM, ON-MBD.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-024 | Линейный пространственный размер | B | geometry-adapter |
| MNA-025 | Проекционный размер по оси или плоскости | B | geometry-adapter |
| MNA-026 | Угловой размер | B | geometry-adapter |
| MNA-027 | Радиус и диаметр | B | geometry-adapter |
| MNA-028 | Размер фаски или скругления | B | geometry-adapter |
| MNA-029 | Размерная заметка отверстия/резьбы | B | geometry-adapter |
| MNA-030 | Минимальное и максимальное расстояние при поддержке геометрии | B | geometry-adapter |
| MNA-031 | Производная аннотация параметра эскиза/операции | B | geometry-adapter |
| MNA-032 | Показать допуск размера | B | geometry-adapter |
| MNA-033 | Перейти к управляющему параметру в его редакторе | B | geometry-adapter |
| MNA-034 | Отличить driven/manual/driving и запретить неверное редактирование | B | geometry-adapter |

### MG05 — Геометрические требования PMI

Источники: CREO-QUERY, NX-PMI, SW-DIMX, ON-TABLE.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-035 | Создать типизированную рамку FCF | C | semantic-pmi, standard-rules, geometry-adapter |
| MNA-036 | Обозначить базовый элемент | C | semantic-pmi, standard-rules, geometry-adapter |
| MNA-037 | Собрать систему баз | C | semantic-pmi, standard-rules, geometry-adapter |
| MNA-038 | Создать базовый участок | C | semantic-pmi, standard-rules, geometry-adapter |
| MNA-039 | Связать допуск с контролируемыми поверхностями | C | semantic-pmi, standard-rules, geometry-adapter |
| MNA-040 | Показать семантические зависимости и DRF | C | semantic-pmi, standard-rules, geometry-adapter |
| MNA-041 | Проверить модификаторы и редакцию стандарта | C | semantic-pmi, standard-rules, geometry-adapter |
| MNA-042 | Различить графическую и семантическую PMI | C | semantic-pmi, standard-rules, geometry-adapter |

### MG06 — Технологические требования модели

Источники: K-ANN, TF-ANN, INV-WELD, ON-TABLE, FUS-MFG.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-043 | Шероховатость/текстура на поверхности | C | typed-requirements, standard-rules |
| MNA-044 | Сварочный знак на модели | C | typed-requirements, standard-rules |
| MNA-045 | Обозначение кромки | C | typed-requirements, standard-rules |
| MNA-046 | Требование покрытия | C | typed-requirements, standard-rules |
| MNA-047 | Требование термообработки | C | typed-requirements, standard-rules |
| MNA-048 | Общие технические требования документа | A | model-annotation-schema |
| MNA-049 | Примечание к отверстию/резьбе из данных операции | C | typed-requirements, standard-rules |
| MNA-050 | Указать источник и статус ручного требования | A | model-annotation-schema |

### MG07 — Текст, поля и стили

Источники: RHINO-STYLE, SE-ADV, FC-LABEL.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-051 | Шрифт и размер надписи | A | text-style-schema |
| MNA-052 | Фрагменты и инженерные символы | A | text-style-schema |
| MNA-053 | Поле имени/материала/свойства компонента | A | text-style-schema |
| MNA-054 | Единицы и точность отображения | A | text-style-schema |
| MNA-055 | Фон/маска и рамка | A | text-style-schema |
| MNA-056 | Стиль документа и локальные переопределения | A | text-style-schema |
| MNA-057 | Экранный размер отдельно от размера в единицах модели | A | text-style-schema |
| MNA-058 | Диагностика недоступного шрифта | A | text-style-schema |

### MG08 — Выноски и размещение

Источники: INV-2026, FC-LABEL, SKETCHUP.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-059 | Создать выноску | A | leader-schema |
| MNA-060 | Добавить/удалить ветвь | A | leader-schema |
| MNA-061 | Изменить стрелку и полку | A | leader-schema |
| MNA-062 | Переставить текст без изменения опоры | A | leader-schema |
| MNA-063 | Изменить опору отдельно от положения текста | A | leader-schema |
| MNA-064 | Переключить пространственную/экранную трассу | A | leader-schema |
| MNA-065 | Выравнять группу надписей | A | leader-schema |
| MNA-066 | Устранить перекрытие с сохранением ручной позиции | A | leader-schema |

### MG09 — Видимость и читаемость

Источники: RHINO-STYLE, NX-PMI, CREO-VIEWS.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-067 | Показать/скрыть выбранные аннотации | B | scene-annotation-renderer |
| MNA-068 | Фильтровать по типу и компоненту | B | scene-annotation-renderer |
| MNA-069 | Показать только выбранное требование | B | scene-annotation-renderer |
| MNA-070 | Настроить поведение за геометрией | B | scene-annotation-renderer |
| MNA-071 | Предупредить о скрытой/потерянной опоре | B | scene-annotation-renderer |
| MNA-072 | Разворачивать читаемую надпись с обратной стороны | B | scene-annotation-renderer |
| MNA-073 | Ограничить плотность подписей при zoom | B | scene-annotation-renderer |
| MNA-074 | Найти и сфокусировать аннотацию | B | scene-annotation-renderer |

### MG10 — Виды аннотаций и сцены

Источники: CREO-VIEWS, TF-SCENE, K-VIEWS, SW-MBD.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-075 | Создать сохранённый вид аннотаций | B | saved-view-schema |
| MNA-076 | Сохранить камеру и плоскости | B | saved-view-schema |
| MNA-077 | Сохранить набор видимых аннотаций | B | saved-view-schema |
| MNA-078 | Добавить сечение к виду | B | saved-view-schema |
| MNA-079 | Связать вид с состоянием сборки/взрывом | B | saved-view-schema |
| MNA-080 | Обновить вид явно | B | saved-view-schema |
| MNA-081 | Заблокировать ориентацию при необходимости | B | saved-view-schema |
| MNA-082 | Просмотреть последовательность видов | B | saved-view-schema |
| MNA-083 | Передать вид в чертёж через отдельный адаптер | B | saved-view-schema |

### MG11 — Выбор и редактирование

Источники: ON-MBD, ON-TABLE, CREO-QUERY.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-084 | Выбрать аннотацию в сцене и дереве | A | annotation-selection, document-history |
| MNA-085 | Подсветить опоры по аннотации | A | annotation-selection, document-history |
| MNA-086 | Подсветить аннотации по геометрии | A | annotation-selection, document-history |
| MNA-087 | Множественный выбор и пакетный стиль | A | annotation-selection, document-history |
| MNA-088 | Редактировать с Apply/OK/Cancel | A | annotation-selection, document-history |
| MNA-089 | Дублировать с явным выбором копирования опор | A | annotation-selection, document-history |
| MNA-090 | Удалить аннотацию отдельно от геометрии | A | annotation-selection, document-history |
| MNA-091 | Отменить/повторить одной транзакцией | A | annotation-selection, document-history |

### MG12 — Ассоциативность и восстановление

Источники: K-ANN, FC-LABEL, ON-MBD.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-092 | Обновить подпись при изменении свойства | B | reference-adapter, diagnostics |
| MNA-093 | Пересчитать размер по геометрии | B | reference-adapter, diagnostics |
| MNA-094 | Пометить потерянную опору | B | reference-adapter, diagnostics |
| MNA-095 | Перепривязать без потери исходного требования | B | reference-adapter, diagnostics |
| MNA-096 | Выявить устаревшее значение | B | reference-adapter, diagnostics |
| MNA-097 | Проследить derived-источник | B | reference-adapter, diagnostics |
| MNA-098 | Проверить контекст конфигурации/экземпляра | B | reference-adapter, diagnostics |
| MNA-099 | Запретить запись устаревшего асинхронного результата | B | reference-adapter, diagnostics |

### MG13 — Шаблоны и автоматизация

Источники: SE-ADV, NX-MBD, ON-TABLE.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-100 | Сохранить шаблон заметки | B | template-schema, capability-registry |
| MNA-101 | Применить библиотеку требований | B | template-schema, capability-registry |
| MNA-102 | Сформировать подписи по свойствам | B | template-schema, capability-registry |
| MNA-103 | Предложить плоскость и положение | B | template-schema, capability-registry |
| MNA-104 | Создать аннотации по поддерживаемым операциям | B | template-schema, capability-registry |
| MNA-105 | Показать предпросмотр пакетного создания | B | template-schema, capability-registry |
| MNA-106 | Применить допуски по явной библиотеке правил | B | template-schema, capability-registry |
| MNA-107 | Сообщить о неподдерживаемых типах | B | template-schema, capability-registry |

### MG14 — Наборы MBD и ревизии

Источники: ON-TABLE, SE-ADV, SW-MBD.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-108 | Организовать дерево наборов аннотаций | B | document-schema, annotation-sets |
| MNA-109 | Связать набор с деталью/экземпляром | B | document-schema, annotation-sets |
| MNA-110 | Показать таблицу требований | B | document-schema, annotation-sets |
| MNA-111 | Назначить идентификатор требования | B | document-schema, annotation-sets |
| MNA-112 | Сохранить контекст версии/конфигурации | B | document-schema, annotation-sets |
| MNA-113 | Сравнить изменения требований | B | document-schema, annotation-sets |
| MNA-114 | Подготовить пакет модели и видов для ревью | B | document-schema, annotation-sets |
| MNA-115 | Запретить неявную перезапись read-only/derived данных | B | document-schema, annotation-sets |

### MG15 — Публикация и обмен

Источники: SW-MBD, SE-MBD, NX-MBD, ON-MBD.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-116 | Сохранить нативные данные аннотаций | A | model-annotation-schema |
| MNA-117 | Экспортировать снимок текущего вида | A | model-annotation-schema |
| MNA-118 | Опубликовать интерактивный 3D PDF через адаптер | C | exchange-adapter |
| MNA-119 | Экспортировать STEP AP242 с объявленным покрытием | C | exchange-adapter |
| MNA-120 | Импортировать графический PMI отдельно от семантического | C | exchange-adapter |
| MNA-121 | Преобразовать импорт в редактируемые объекты с отчётом | C | exchange-adapter |
| MNA-122 | Проверить round-trip опор/полей/видов | C | exchange-adapter |
| MNA-123 | Экспортировать таблицу требований CSV | B | annotation-sets |
| MNA-124 | Подключить JT/QIF только при наличии адаптера | C | exchange-adapter |
| MNA-125 | Показать отчёт потерь до экспорта | C | exchange-adapter |

### MG16 — Проверки и измерительный контроль

Источники: SE-ADV, CREO-QUERY, FUS-INSPECT.

| ID | Инструмент / возможность | Этап | Зависимость |
|---|---|---|---|
| MNA-126 | Проверить структуру и ссылки | A | model-annotation-schema |
| MNA-127 | Проверить нормативный набор правил | C | validation-adapter |
| MNA-128 | Найти недо-/переопределённые требования при поддержке анализа | C | validation-adapter |
| MNA-129 | Экспортировать измеряемые характеристики | C | validation-adapter |
| MNA-130 | Связать результат измерения с требованием | C | validation-adapter |
| MNA-131 | Отличить номинальное требование от фактического результата | C | validation-adapter |
| MNA-132 | Проверить доступность и читаемость вида | A | model-annotation-schema |
| MNA-133 | Проверить сохранение, Undo/Redo и миграцию | A | model-annotation-schema |

## Данные и контракт реализации

В документе нужны самостоятельные `modelAnnotations`, `annotationFrames`, `annotationViews` и `annotationSets`; Drawing хранится отдельно. Общие типизированные требования SYM/DIM можно переиспользовать после выделения независимого смыслового слоя, но перенос XY-координат в XYZ без преобразования недопустим.

Минимальная аннотация хранит `id`, `kind`, `content`, `provenance`, `modelRefs`, `frameId`, `placement`, `styleId`, `visibilityPolicy`, `revisionContext`. Для нормативного требования добавляются `standardId`, `edition`, `system`, единицы и типизированные параметры. Для значения размера отдельно хранится `valueSource: manual | geometry | featureParameter`, метрика и статус актуальности. Редактирование `featureParameter` переводит в редактор операции/эскиза; не подменяет модель числом на подписи.

Опора хранит document/part/occurrence и устойчивый идентификатор геометрического элемента плюс тип опоры. Triangle index или последний worldPoint не заменяют семантическую ссылку на грань. Привязка только к компоненту допустима на первом этапе, если явно не выдаётся за привязку к грани. Потерянные/неразрешённые опоры сохраняются для восстановления и показывают диагностику.

Плоскость определяет локальный базис и положение. Представление хранит камеру, clipping/section, видимость и состояние экземпляров. Сдвиг текста, смена камеры и изменение опоры — разные операции. Нужны явные преобразования object/local/world/screen и отдельные единицы размера шрифта. Зеркало, неравномерный масштаб и взрыв сборки не должны молча менять номинальное измерение.

Для FCF/шероховатости/сварки переиспользуется перечень полей из [инженерного каталога SYM](DRAWING_ENGINEERING_TOOLKIT.md), но нормативные наборы правил требуют отдельной проверки редакций ISO/ASME/AWS/ГОСТ. Нельзя объявлять нормативную корректность по стилю отображения. Текстовый ярлык не заменяет WPS или расчёт шва.

Capability registry должен отдельно сообщать: поддерживаемые типы опор; метрические операции; graphic/semantic PMI; стандарт/редакцию; формат и направление обмена. Отсутствие адаптера отключает команду с объяснением. Screenshot, SVG вида, графический 3D PDF и семантический STEP не считаются равнозначными результатами. Само расширение `.step` или AP242 не гарантирует round-trip всех видов/модификаторов/опор.

## Этапы поставки

1. **A: редактируемые заметки.** Версионируемая схема, компонентные/мировые опоры, плоскости и экранные заметки, текст/стили/выноски, выбор, save/open/recovery и Undo. Компактные диалоги с прямыми углами, техническими SVG-иконками, клавиатурой, темами и inline-валидацией. Сначала миграция данных, затем сцена и UI отдельными пакетами.
2. **B: управляемая сцена требований.** Устойчивые опоры через реальный reference adapter, потерянные связи, сохранённые виды/таблица требований, свойства и шаблоны. Геометрические размеры только для подтверждённых форм/метрик. При работе с примитивами явно указывать охват. Не ждать C для CSV/снимков/диагностики.
3. **C: специализированный PMI.** Типизированные FCF/базы/технологические требования по проверенным правилам, семантический запрос, публикация/обмен и измерительный контроль через реальные адаптеры. Текст-в-геометрию остаётся отдельной моделирующей операцией. Выпускать по небольшому PR на профиль/адаптер, а не обещать весь стандарт одним переключателем.

## Приёмка и проверки будущей реализации

- Создание/изменение/отмена не меняют геометрию и документ до подтверждения; один Undo восстанавливает связанные данные.
- Save/open/recovery сохраняют поля, опоры, плоскости, виды, единицы и ревизии; неизвестные старые коды не теряются. Не разрешается молча записывать файлы будущей схемы.
- Rotation/zoom/pan меняют представление, но не значение требования; отдельно проверяются object/local/world/screen, зеркала, неравномерный scale и экземпляры сборки.
- После изменения/удаления/подавления источника значение обновляется либо явно помечается устаревшим; неверная подпись не выглядит достоверной.
- Projected и true-3D расстояния проверяются на примере, где результаты различаются. Переориентация рамки не меняет метрику без явного действия.
- Derived/read-only аннотация ведёт к исходному документу; запоздалый callback не пишет в другой активный документ.
- Выбор в сцене, дереве и таблице согласован; опоры подсвечиваются. Скрытые источники и отсутствующие источники имеют разные состояния.
- Сечения/окклюзия/маски/перекрытия и поведение при orbit тестируются на сохранённых видах; за геометрией нельзя рисовать вводящую в заблуждение опору.
- Нормативные примеры проверяются отдельно для каждого стандарта/редакции/системы сварки; геометрическая проверка и результаты реального измерения имеют отдельные статусы.
- Export/import объявляет graphic/semantic покрытие, предупреждает о потерях и проходит независимый round-trip по опорам, значениям, модификаторам и видам.
- E2E охватывает клавиатуру, две темы, отмену, перепривязку, документные гонки и повторное открытие. Нормативные тесты не подменяются проверкой наличия кнопки.

## Источники

Краткие формулировки — собственные резюме. Материалы различаются по времени и глубине; источники о публикации не доказывают все возможности authoring или семантического обмена.

- **NX-MBD** [NX June 2023](https://blogs.sw.siemens.com/designcenter/whats-new-nx-model-based-definition-2/) — PMI, Convert PMI с предупреждениями, заметки отверстий по граням без истории, автоматизация MBD.
- **NX-PMI** [NX PMI, материал 2025](https://blogs.sw.siemens.com/designcenter/nx-tips-and-tricks-pmi/) — FCF, плоскость/выноска, библиотеки правил, заметки параллельно экрану.
- **CREO-MBD** [Creo Parametric 12](https://support.ptc.com/help/creo/creo_pma/r12/usascii/model-based_definition/overview_model_based_design.html) — 3D-размеры, GTOL, символы, заметки, повторное использование размеров модели.
- **CREO-QUERY** [Creo Parametric 12](https://support.ptc.com/help/creo/creo_pma/r12/usascii/model-based_definition/about_semantic_query.html) — Semantic Query с семантическими опорами, подсветка поверхностей и связанных баз/DRF.
- **CREO-VIEWS** [Creo Parametric 12](https://support.ptc.com/help/creo/creo_pma/r12/usascii/model-based_definition/about_assigning_annots_to_combination_states.html) — Combined states: ориентация, разрез, взрыв, упрощение, видимость. Возможен приоритет над скрытым слоем.
- **CATIA-FT1** [CATIA V5 FT1](https://3dswym.3dexperience.3ds.com/wiki/catia-user-community/catia-3d-functional-tolerancing-and-annotations-1-ft1_J6eUA2eOSX-2Drxj7l4qEA) — 3D-размеры/знаки/плоскости; производитель прямо ограничивает полноту семантической ассоциативности FT1.
- **CATIA-TAD** [CATIA 3DEXPERIENCE TAD, материал 2025](https://3dswym.3dexperience.3ds.com/wiki/catia-user-community/success-path-3d-tolerancing-annotation-designer_sHeDmqh6Sb66DyOOfNnn1g) — Роль TAD: tolerancing advisor, captures, просмотр/фильтрация; не универсальная лицензия CATIA.
- **SE-MBD** [Solid Edge MBD, datasheet 09/2024](https://blogs.sw.siemens.com/wp-content/uploads/sites/8/2024/11/Siemens-SW-Solid-Edge-Model-Based-Definition-FS-78027-D14.pdf) — Публикация 3D PDF с PMI, метаданными, видами и шаблонами.
- **SE-ADV** [Solid Edge Advanced PMI, datasheet 09/2024](https://blogs.sw.siemens.com/wp-content/uploads/sites/8/2024/11/Siemens-SW-Using-Solid-Edge-Advanced-PMI-FS-84801-D5.pdf) — Автоматические размеры/допуски, проверка определённости, виды, библиотека заметок и подсветка граней.
- **SW-DIMX** [SOLIDWORKS 2026 DimXpert](https://help.solidworks.com/2026/english/SolidWorks/sldworks/t_using_dimxpert.htm?id=31.1.2) — Размеры и допуски модели, ручное/автоматическое создание, статус определённости.
- **SW-MBD** [SOLIDWORKS MBD](https://www.solidworks.com/product/solidworks-mbd) — Отдельный продукт MBD; организация PMI, 3D views, публикация 3D PDF/STEP 242; базовые аннотации доступны и в Standard.
- **SW-TOOLS** [SOLIDWORKS 2026 MBD Toolbar](https://help.solidworks.com/2026/english/SolidWorks/sldworks/r_mbd_toolbar.htm?id=2.12.4.1.18) — Инструменты MBD и ограничения конкретной установки с 3DEXPERIENCE.
- **INV-3DA** [Inventor 2025](https://help.autodesk.com/cloudhelp/2025/ENU/Inventor-Help/files/GUID-B8779786-A71C-4A5C-B9A9-7EB1A9918946.htm) — 3D Annotation в детали/сборке; Tolerance Feature/Advisor для детали; design views, cross-highlighting, единицы Active Standard.
- **INV-WELD** [Inventor 2024](https://help.autodesk.com/cloudhelp/2024/ENU/Inventor-WhatsNew/files/GUID-A0B07812-EB30-4898-B53E-1112CF02DB2C.htm) — 3D weld/subweld в детали и сборке без обязательного weldment, получение в Drawing и публикация.
- **INV-2026** [Inventor 2026](https://help.autodesk.com/cloudhelp/2026/ENU/Inventor-WhatsNew/files/GUID-FB6DF8DA-9009-4DAD-9277-2CA2A6DF34EA.htm) — Datum targets, несколько опор выноски, параметры в тексте.
- **FUS-DESIGN** [Fusion Design Extension, текущая справка](https://help.autodesk.com/cloudhelp/ENU/Fusion-Extensions/files/EXT-PRODUCT-DESIGN.htm) — Перечислено PMI Authoring; доступ зависит от расширения и типа подписки.
- **FUS-MFG** [Fusion Manufacturing Extension, текущая справка](https://help.autodesk.com/cloudhelp/ENU/Fusion-Extensions/files/EXT-MANUFACTURING.htm) — PMI Authoring: явно перечислены Hole/Thread Note и Note.
- **FUS-INSPECT** [Fusion CAM, текущая справка](https://help.autodesk.com/cloudhelp/ENU/Fusion-CAM/files/MFG-PMI-FOR-INSPECTION-OVERVIEW.htm) — Использование PMI в inspection/probing; перенос size tolerances ограничен linear/diameter.
- **ON-MBD** [Onshape Part Studio, текущая справка](https://cad.onshape.com/help/Content/PartStudio/model_based_definition.htm) — MBD в модели, driving/driven/derived различаются; экспорт STEP с ограничениями для closed composite parts.
- **ON-TABLE** [Onshape Part Studio, текущая справка](https://cad.onshape.com/help/Content/PartStudio/inspection_table.htm) — Inspection table: datum, dimension/fillet/min/max, GTOL, weld; ориентация, CSV, выбор модели. Не Drawing toolbar.
- **K-DIMS** [КОМПАС-3D v24](https://help.ascon.ru/KOMPAS/24/ru-RU/741_65_1_obchie_svedeniy_o_razmerah.html) — Управляющие и информационные размеры; производные размеры для постоянного отображения.
- **K-PLANE** [КОМПАС-3D v24](https://help.ascon.ru/KOMPAS/24/ru-RU/ploskost_razmera.html) — Плоскость может задавать проекционное значение, не истинное пространственное расстояние.
- **K-ANN** [КОМПАС-3D v24](https://help.ascon.ru/KOMPAS/24/ru-RU/oboznacheniya_3d_obzor.html) — Пространственные шероховатость, базы, допуски формы, выноски; обозначение может остаться после исчезновения источника.
- **K-TT** [КОМПАС-3D v24](https://help.ascon.ru/KOMPAS/24/ru-RU/1006_gl_104_tech_treb.html) — ТТ модели отображаются поверх сцены; не текст на пространственной плоскости.
- **K-VIEWS** [КОМПАС-3D v24](https://help.ascon.ru/KOMPAS/24/ru-RU/cm_viewproj_settings.html) — Сохранённые ориентации со слоями и сечением.
- **TF-ANN** [T-FLEX CAD 17](https://www.tflex.com/help/eng/T-FLEX%20CAD/17/3d_annotations.htm) — Собственные 3D-аннотации отдельно от отображаемых 2D-элементов рабочей плоскости; размеры, GD&T, базы, шероховатость, сварка.
- **TF-DIM** [T-FLEX CAD 17](https://www.tflex.com/help/eng/T-FLEX%20CAD/17/10_dimension_3d.htm) — Опоры грань/ребро/вершина/ось/путь/узел, плоскости, отдельное управление через параметрические связи.
- **TF-ORIENT** [T-FLEX CAD 18](https://www.tflexcad.ru/help/cad/18/22_1_orient.htm) — Ориентация по сцене, рабочей плоскости, грани, ЛСК; обращение к экрану документировано для надписей.
- **TF-SCENE** [T-FLEX CAD 18](https://www.tflexcad.ru/help/cad/18/07_scene_create.htm) — Сцены: камера, видимость геометрии/аннотаций, сечения, экранное наложение страницы.
- **TF-TT17** [T-FLEX CAD 17](https://www.tflexcad.ru/help/cad/17/technicalrequirements.htm) — ТТ страницы после вставки не сохраняют ассоциативную связь с ТТ документа.
- **TF-TT18** [T-FLEX CAD 18](https://www.tflexcad.ru/help/cad/18/10_drawingnotes_place.htm) — Изменённая семантика: двусторонняя связь размещённых ТТ; на странице 3D — экранное наложение.
- **FC-DIM** [FreeCAD Draft, документация нескольких версий](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Draft_Dimension.md) — Размеры в 3D-виде: связанные линейные/радиальные; угловые по документации не параметрические.
- **FC-LABEL** [FreeCAD Draft, документация нескольких версий](https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Draft_Label.md) — Выноска, объект/подэлемент, текст свойств, World/Screen. Не полноценный GD&T.
- **RHINO-ANN** [Rhino, developer guide](https://developer.rhino3d.com/guides/cpp/annotation-objects/) — Text/Leader/Dimension, плоскость, положение, стиль; SDK-архитектура, не доказательство семантического PMI.
- **RHINO-STYLE** [Rhino 8](https://docs.mcneel.com/rhino/8/help/en-us/documentproperties/annotation.htm) — Стили, model/layout scale, читаемость с обратной стороны, горизонтально к виду, маска, предупреждения шрифтов.
- **SKETCHUP** [SketchUp, текущая справка](https://help.sketchup.com/en/sketchup/adding-text-labels-and-dimensions-model) — Screen text, leader text, геометрический 3D Text и динамические размеры — разные инструменты.
- **AUTOCAD** [AutoCAD, support article](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-annotate-a-3D-object-in-AutoCAD.html) — Размещение размеров 3D-объекта через UCS; проверен индексируемый текст, full body недоступен в браузере исследования.
- **BRICS-UCS** [BricsCAD, текущая справка UCS](https://help.bricsys.com/en-us/document/bricscad/drawing-accurately/user-coordinate-systems) — Произвольные UCS в 3D и плоское создание объектов; не доказательство самостоятельной семантической PMI-подсистемы.
- **NANO** [nanoCAD, компонент 3D, без версии на странице](https://nanocad.ru/products/platforma/komponent_3d/features/) — Моделирование и ассоциативная 2D-документация; семантический 3D PMI по этой странице не установлен.
- **REVIT** [Revit 2024](https://help.autodesk.com/cloudhelp/2024/ENU/Revit-DocumentPresent/files/GUID-CEF1A80C-C184-4FC1-8679-D211BE2361E9.htm) — Tags/keynotes только в locked 3D view; не perspective/default; при unlock скрыты; новая сохранённая ориентация может удалить прежние.
- **ARCHICAD** [ARCHICAD 24](https://help.graphisoft.com/AC/24/INT/_AC24_Help/050_ViewsVB/050_ViewsVB-57.htm) — 3D Document основан на модели/плане, к нему добавляются 2D dimensions/labels; не свободно вращаемая 3D PMI-сцена.

Связанные материалы: [текст чертежа](DRAWING_TEXT_TOOLKIT.md), [таблицы](DRAWING_TABLE_TOOLKIT.md), [размеры](DRAWING_DIMENSION_TOOLKIT.md), [инженерные обозначения](DRAWING_ENGINEERING_TOOLKIT.md). [Машиночитаемый каталог](MODEL_ANNOTATION_TOOLKIT.json).
