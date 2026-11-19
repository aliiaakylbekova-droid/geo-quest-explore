export type Achievement = {
  id: string
  title: string
  hint: string
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-step", title: "Первый шаг", hint: "Зарегистрируй исследователя." },
  { id: "globe-spin", title: "Вращение мира", hint: "Открой World Explorer." },
  { id: "first-mission", title: "Географ", hint: "Заверши любую гео-миссию." },
  { id: "challenge", title: "Чемпион вызова", hint: "Пройди World Challenge." },
  { id: "silk-road", title: "Шёлковый путь", hint: "Пройди все пять стран Центральной Азии." },
  { id: "collector", title: "Коллекционер", hint: "Собери 8 достопримечательностей." },
  { id: "xp-500", title: "Знаток", hint: "Набери 500 опыта." },
  { id: "xp-1500", title: "Картограф", hint: "Набери 1500 опыта." },
  { id: "open-10", title: "Десять стран", hint: "Открой 10 стран на глобусе." },
  { id: "open-50", title: "Полтинник", hint: "Открой 50 стран." },
  { id: "open-100", title: "Сотня", hint: "Открой 100 стран." },
  { id: "streak-5", title: "Серия 5", hint: "Пять верных ответов подряд." },
  { id: "streak-10", title: "Серия 10", hint: "Десять верных ответов подряд." },
  { id: "login-3", title: "Три дня", hint: "Заходи три дня подряд." },
  { id: "daily-first", title: "Ежедневный старт", hint: "Закрой все задания дня." },
  { id: "asia-12", title: "Азия", hint: "Открой 12 стран Азии." },
  { id: "puzzle-asia", title: "Пазл Азии", hint: "Собери карту Азии на лёгком уровне." },
  { id: "puzzle-first", title: "Картограф-сборщик", hint: "Собери любой материк в MAP PUZZLE." },
  { id: "journey-first", title: "Путешественник", hint: "Пройди GEO JOURNEY на одном материке." },
]
