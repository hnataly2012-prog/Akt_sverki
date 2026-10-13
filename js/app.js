"use strict";

const KEY = "reconciliationApp_v1";
const defaultState = {
  company: { fullName: "", shortName: "", inn: "", kpp: "", position: "", signer: "" },
  counterparties: [],
  types: [
    { id: "t1", name: "Начисление за оказанные услуги", effect: 1 },
    { id: "t2", name: "Начисление за выполненные работы", effect: 1 },
    { id: "t3", name: "Оплата от контрагента", effect: -1 },
    { id: "t4", name: "Возврат денежных средств", effect: 1 },
    { id: "t5", name: "Корректировка начисления (+)", effect: 1 },
    { id: "t6", name: "Корректировка начисления (−)", effect: -1 },
    { id: "t7", name: "Корректировка оплаты (+ долг)", effect: 1 },
    { id: "t8", name: "Корректировка оплаты (− долг)", effect: -1 },
    { id: "t9", name: "Сторно (+)", effect: 1 },
    { id: "t10", name: "Сторно (−)", effect: -1 },
    { id: "t11", name: "Прочая операция (+)", effect: 1 },
    { id: "t12", name: "Прочая операция (−)", effect: -1 }
  ],
  operations: [],
  openings: []
};

let state = load();

function load() {
  try {
    const x = JSON.parse(localStorage.getItem(KEY));
    return x ? Object.assign(structuredClone(defaultState), x) : structuredClone(defaultState);
  } catch (e) {
    return structuredClone(defaultState);
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

const $ = (id) => document.getElementById(id);
const uid = (prefix) => prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[c]));

function toCents(v) {
  const s = String(v ?? "").trim().replace(/\s/g, "").replace("₽", "").replace(",", ".");
  if (!s) return 0;
  if (!/^-?\d+(\.\d{0,2})?$/.test(s)) {
    throw new Error("Введите корректную сумму, не более двух знаков после запятой.");
  }
  return Math.round(Number(s) * 100);
}

function money(c) {
  return (c / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
}

function dateRu(s) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function cpById(id) {
  return state.counterparties.find((x) => x.id === id);
}

function typeById(id) {
  return state.types.find((x) => x.id === id);
}

function selectedCp() {
  return $("workCounterparty").value;
}

function getOpening() {
  const cp = selectedCp();
  const from = $("dateFrom").value;
  const x = state.openings.find((o) => o.counterpartyId === cp && o.periodStart === from);
  return x ? x.cents : 0;
}

function showTab(tabId) {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x.dataset.tab === tabId));
  document.querySelectorAll(".panel").forEach((x) => x.classList.toggle("active", x.id === tabId));
}

function renderAll() {
  renderCpSelect();
  renderCpTable();
  renderTypes();
  renderOperations();
  loadCompany();
}

document.querySelectorAll(".tab").forEach((b) => {
  b.onclick = () => showTab(b.dataset.tab);
});

function renderCpSelect() {
  const sel = $("workCounterparty");
  const old = sel.value;
  sel.innerHTML = '<option value="">— выберите —</option>' +
    state.counterparties
      .filter((x) => !x.archived)
      .map((c) => `<option value="${c.id}">${esc(c.shortName || c.fullName)}</option>`)
      .join("");
  if (state.counterparties.some((x) => x.id === old && !x.archived)) sel.value = old;
}

function clearCpForm() {
  ["cpId", "cpFull", "cpShort", "cpInn", "cpKpp", "cpContract", "cpContractDate", "cpNote"].forEach((id) => {
    $(id).value = "";
  });
}

$("clearCp").onclick = clearCpForm;

$("saveCp").onclick = () => {
  if (!$("cpFull").value.trim()) return alert("Укажите полное наименование контрагента.");
  const id = $("cpId").value || uid("cp");
  const obj = {
    id,
    fullName: $("cpFull").value.trim(),
    shortName: $("cpShort").value.trim(),
    inn: $("cpInn").value.trim(),
    kpp: $("cpKpp").value.trim(),
    contract: $("cpContract").value.trim(),
    contractDate: $("cpContractDate").value,
    note: $("cpNote").value.trim(),
    archived: false
  };
  const i = state.counterparties.findIndex((x) => x.id === id);
  if (i >= 0) obj.archived = state.counterparties[i].archived;
  if (i >= 0) state.counterparties[i] = obj;
  else state.counterparties.push(obj);
  save();
  clearCpForm();
  renderAll();
};

function renderCpTable() {
  $("cpBody").innerHTML = state.counterparties.length
    ? state.counterparties.map((c) => `<tr>
        <td>${esc(c.fullName)}${c.archived ? ' <span class="muted">(архив)</span>' : ""}</td>
        <td>${esc(c.inn)}</td>
        <td>${esc(c.kpp)}</td>
        <td>${esc(c.contract)}</td>
        <td>
          <button class="light" data-action="edit-cp" data-id="${c.id}">Изменить</button>
          <button class="secondary" data-action="archive-cp" data-id="${c.id}">${c.archived ? "Вернуть" : "В архив"}</button>
        </td>
      </tr>`).join("")
    : '<tr><td colspan="5" class="empty">Контрагентов пока нет.</td></tr>';
}

$("cpBody").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "edit-cp") {
    const c = cpById(id);
    $("cpId").value = c.id;
    $("cpFull").value = c.fullName;
    $("cpShort").value = c.shortName;
    $("cpInn").value = c.inn;
    $("cpKpp").value = c.kpp;
    $("cpContract").value = c.contract;
    $("cpContractDate").value = c.contractDate;
    $("cpNote").value = c.note;
  }
  if (btn.dataset.action === "archive-cp") {
    const c = cpById(id);
    c.archived = !c.archived;
    save();
    renderAll();
  }
});

function loadCompany() {
  const c = state.company;
  $("myFull").value = c.fullName;
  $("myShort").value = c.shortName;
  $("myInn").value = c.inn;
  $("myKpp").value = c.kpp;
  $("myPosition").value = c.position;
  $("mySigner").value = c.signer;
}

$("saveCompany").onclick = () => {
  state.company = {
    fullName: $("myFull").value.trim(),
    shortName: $("myShort").value.trim(),
    inn: $("myInn").value.trim(),
    kpp: $("myKpp").value.trim(),
    position: $("myPosition").value.trim(),
    signer: $("mySigner").value.trim()
  };
  save();
  alert("Данные организации сохранены.");
};

function clearType() {
  $("typeId").value = "";
  $("typeName").value = "";
  $("typeEffect").value = "1";
}

$("clearType").onclick = clearType;

$("saveType").onclick = () => {
  const name = $("typeName").value.trim();
  if (!name) return alert("Введите название типа.");
  const id = $("typeId").value || uid("type");
  const obj = { id, name, effect: Number($("typeEffect").value) };
  const i = state.types.findIndex((x) => x.id === id);
  if (i >= 0) state.types[i] = obj;
  else state.types.push(obj);
  save();
  clearType();
  renderTypes();
  renderOperations();
};

function renderTypes() {
  $("typesBody").innerHTML = state.types.map((t) => `<tr>
    <td>${esc(t.name)}</td>
    <td>${t.effect > 0 ? "+ увеличивает" : "− уменьшает"}</td>
    <td><button class="light" data-action="edit-type" data-id="${t.id}">Изменить</button></td>
  </tr>`).join("");
  const old = $("opType").value;
  $("opType").innerHTML = state.types.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  if (state.types.some((t) => t.id === old)) $("opType").value = old;
}

$("typesBody").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action='edit-type']");
  if (!btn) return;
  const t = typeById(btn.dataset.id);
  $("typeId").value = t.id;
  $("typeName").value = t.name;
  $("typeEffect").value = String(t.effect);
});

$("saveOpening").onclick = () => {
  if (!selectedCp()) return alert("Сначала выберите контрагента.");
  if (!$("dateFrom").value) return alert("Укажите начало периода.");
  try {
    const amount = Math.abs(toCents($("openingAmount").value));
    const dir = Number($("openingDirection").value);
    const cents = amount * dir;
    const i = state.openings.findIndex((o) => o.counterpartyId === selectedCp() && o.periodStart === $("dateFrom").value);
    const obj = { counterpartyId: selectedCp(), periodStart: $("dateFrom").value, cents };
    if (i >= 0) state.openings[i] = obj;
    else state.openings.push(obj);
    save();
    renderOperations();
  } catch (e) {
    alert(e.message);
  }
};

function loadOpeningToForm() {
  const c = getOpening();
  $("openingAmount").value = (Math.abs(c) / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  $("openingDirection").value = c > 0 ? "1" : c < 0 ? "-1" : "0";
}

["workCounterparty", "dateFrom", "dateTo"].forEach((id) => {
  $(id).addEventListener("change", () => {
    loadOpeningToForm();
    renderOperations();
  });
});

function clearOp() {
  $("editOperationId").value = "";
  $("opDate").value = today();
  $("opNumber").value = "";
  $("opAmount").value = "";
  $("opDescription").value = "";
  $("opComment").value = "";
  $("saveOperation").textContent = "Добавить операцию";
  $("cancelEdit").style.display = "none";
}

$("cancelEdit").onclick = clearOp;

$("saveOperation").onclick = () => {
  const cp = selectedCp();
  if (!cp) return alert("Выберите контрагента.");
  if (!$("opDate").value) return alert("Укажите дату операции.");
  if (!$("opType").value) return alert("Выберите тип операции.");
  try {
    const cents = Math.abs(toCents($("opAmount").value));
    if (cents === 0) return alert("Сумма операции должна быть больше нуля.");
    const id = $("editOperationId").value || uid("op");
    const old = state.operations.find((x) => x.id === id);
    const obj = {
      id,
      counterpartyId: cp,
      date: $("opDate").value,
      typeId: $("opType").value,
      number: $("opNumber").value.trim(),
      description: $("opDescription").value.trim(),
      comment: $("opComment").value.trim(),
      cents,
      createdAt: old?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const i = state.operations.findIndex((x) => x.id === id);
    if (i >= 0) state.operations[i] = obj;
    else state.operations.push(obj);
    save();
    clearOp();
    renderOperations();
  } catch (e) {
    alert(e.message);
  }
};

function periodOps() {
  const cp = selectedCp();
  const from = $("dateFrom").value;
  const to = $("dateTo").value;
  return state.operations
    .filter((o) => o.counterpartyId === cp && (!from || o.date >= from) && (!to || o.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

function calc() {
  const opening = getOpening();
  let inc = 0;
  let dec = 0;
  for (const o of periodOps()) {
    const t = typeById(o.typeId);
    if (!t) continue;
    if (t.effect > 0) inc += o.cents;
    else dec += o.cents;
  }
  return { opening, inc, dec, closing: opening + inc - dec };
}

function debtText(cents, cp) {
  if (cents > 0) {
    return `Задолженность ${cp?.shortName || cp?.fullName || "контрагента"} перед ${state.company.shortName || state.company.fullName || "нашей организацией"}: ${money(cents)}.`;
  }
  if (cents < 0) {
    return `Задолженность ${state.company.shortName || state.company.fullName || "нашей организации"} перед ${cp?.shortName || cp?.fullName || "контрагентом"}: ${money(Math.abs(cents))}.`;
  }
  return "Задолженность отсутствует.";
}

function renderOperations() {
  const ops = periodOps();
  $("operationsBody").innerHTML = ops.length
    ? ops.map((o) => {
      const t = typeById(o.typeId);
      return `<tr>
        <td>${dateRu(o.date)}</td>
        <td>${esc(t?.name || "")}</td>
        <td>${esc(o.number)}</td>
        <td>${esc(o.description)}</td>
        <td class="num">${money(o.cents)}</td>
        <td>${t?.effect > 0 ? "+" : "−"}</td>
        <td>
          <button class="light" data-action="edit-op" data-id="${o.id}">Изменить</button>
          <button class="danger" data-action="delete-op" data-id="${o.id}">Удалить</button>
        </td>
      </tr>`;
    }).join("")
    : '<tr><td colspan="7" class="empty">Операций за выбранный период нет.</td></tr>';
  const x = calc();
  $("sumOpening").textContent = money(x.opening);
  $("sumIncrease").textContent = money(x.inc);
  $("sumDecrease").textContent = money(x.dec);
  $("sumClosing").textContent = money(x.closing);
  $("debtStatus").textContent = selectedCp()
    ? debtText(x.closing, cpById(selectedCp()))
    : "Выберите контрагента или загрузите пример данных.";
}

$("operationsBody").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "edit-op") {
    const o = state.operations.find((x) => x.id === id);
    if (!o) return;
    $("editOperationId").value = o.id;
    $("opDate").value = o.date;
    $("opType").value = o.typeId;
    $("opNumber").value = o.number;
    $("opAmount").value = (o.cents / 100).toFixed(2).replace(".", ",");
    $("opDescription").value = o.description;
    $("opComment").value = o.comment;
    $("saveOperation").textContent = "Сохранить изменения";
    $("cancelEdit").style.display = "inline-block";
    window.scrollTo({ top: 250, behavior: "smooth" });
  }
  if (btn.dataset.action === "delete-op") {
    if (!confirm("Удалить эту операцию?")) return;
    state.operations = state.operations.filter((x) => x.id !== id);
    save();
    renderOperations();
  }
});

function actHtml() {
  const cp = cpById(selectedCp());
  if (!cp) throw new Error("Выберите контрагента.");
  const from = $("dateFrom").value;
  const to = $("dateTo").value;
  if (!from || !to) throw new Error("Укажите период сверки.");
  const org = state.company;
  const x = calc();
  const ops = periodOps();
  const rows = ops.map((o) => {
    const t = typeById(o.typeId);
    const plus = t?.effect > 0;
    const doc = [o.description, o.number ? `№ ${o.number}` : ""].filter(Boolean).join(" ");
    return `<tr>
      <td>${dateRu(o.date)}</td>
      <td>${esc(doc || t?.name)}</td>
      <td class="num">${plus ? "" : money(o.cents)}</td>
      <td class="num">${plus ? money(o.cents) : ""}</td>
      <td>${dateRu(o.date)}</td>
      <td>${esc(doc || t?.name)}</td>
      <td class="num">${plus ? money(o.cents) : ""}</td>
      <td class="num">${plus ? "" : money(o.cents)}</td>
    </tr>`;
  }).join("");
  const leftOpenDebit = x.opening < 0 ? money(Math.abs(x.opening)) : "";
  const leftOpenCredit = x.opening > 0 ? money(x.opening) : "";
  const rightOpenDebit = x.opening > 0 ? money(x.opening) : "";
  const rightOpenCredit = x.opening < 0 ? money(Math.abs(x.opening)) : "";
  return `<h1>Акт сверки взаимных расчетов</h1>
    <div class="center">за период с ${dateRu(from)} по ${dateRu(to)}</div>
    <div class="center">между ${esc(org.fullName || org.shortName || "________________")} и ${esc(cp.fullName)}</div>
    <p>Договор: ${esc(cp.contract || "—")}${cp.contractDate ? ` от ${dateRu(cp.contractDate)}` : ""}</p>
    <table>
      <thead>
        <tr>
          <th colspan="4">По данным Контрагента: ${esc(cp.shortName || cp.fullName)}</th>
          <th colspan="4">По данным Исполнителя: ${esc(org.shortName || org.fullName || "")}</th>
        </tr>
        <tr>
          <th>Дата</th><th>Документ</th><th>Дебет</th><th>Кредит</th>
          <th>Дата</th><th>Документ</th><th>Дебет</th><th>Кредит</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td></td><td><b>Сальдо на начало периода</b></td>
          <td class="num">${leftOpenDebit}</td><td class="num">${leftOpenCredit}</td>
          <td></td><td><b>Сальдо на начало периода</b></td>
          <td class="num">${rightOpenDebit}</td><td class="num">${rightOpenCredit}</td>
        </tr>
        ${rows || '<tr><td colspan="8" class="center">Операций за период нет</td></tr>'}
        <tr>
          <td></td><td><b>Обороты за период</b></td>
          <td class="num"><b>${money(x.dec)}</b></td><td class="num"><b>${money(x.inc)}</b></td>
          <td></td><td><b>Обороты за период</b></td>
          <td class="num"><b>${money(x.inc)}</b></td><td class="num"><b>${money(x.dec)}</b></td>
        </tr>
      </tbody>
    </table>
    <p><b>Сальдо на конец периода:</b> ${money(Math.abs(x.closing))}. ${esc(debtText(x.closing, cp))}</p>
    <div class="signs">
      <div>
        <b>От ${esc(cp.shortName || cp.fullName)}</b>
        <div class="signature">________________ / __________________</div>
      </div>
      <div>
        <b>От ${esc(org.shortName || org.fullName || "Исполнителя")}</b>
        <div class="signature">${esc(org.position || "________________")} &nbsp; ________________ / ${esc(org.signer || "________________")}</div>
      </div>
    </div>`;
}

$("previewAct").onclick = () => {
  try {
    $("actContent").innerHTML = actHtml();
    window.print();
  } catch (e) {
    alert(e.message);
  }
};

$("exportBackup").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "acts_backup_" + today() + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
};

$("importBackup").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const x = JSON.parse(r.result);
      if (!x.counterparties || !x.operations || !x.types) throw new Error();
      if (confirm("Заменить текущие данные данными из резервной копии?")) {
        state = x;
        save();
        renderAll();
        loadOpeningToForm();
      }
    } catch (err) {
      alert("Не удалось прочитать резервную копию.");
    }
  };
  r.readAsText(f);
  e.target.value = "";
};

function loadDemo() {
  if (state.counterparties.length || state.operations.length) {
    if (!confirm("Загрузить пример? Текущие данные организации, контрагентов и операций будут заменены демонстрационными.")) {
      return;
    }
  }
  const from = monthStart();
  const mid = today();
  const cpId = "cp_demo_1";
  state.company = {
    fullName: 'ООО «Северные коммуникации»',
    shortName: 'ООО «Северные коммуникации»',
    inn: "7701234567",
    kpp: "770101001",
    position: "Генеральный директор",
    signer: "Иванов И. И."
  };
  state.counterparties = [{
    id: cpId,
    fullName: 'ООО «Альфа-сервис»',
    shortName: 'ООО «Альфа-сервис»',
    inn: "7809876543",
    kpp: "780901001",
    contract: "ДС-42/2026",
    contractDate: "2026-01-15",
    note: "Демонстрационный контрагент",
    archived: false
  }];
  state.openings = [{ counterpartyId: cpId, periodStart: from, cents: 1500000 }];
  state.operations = [
    {
      id: "op_demo_1",
      counterpartyId: cpId,
      date: from,
      typeId: "t1",
      number: "18",
      description: "Акт оказанных услуг",
      comment: "",
      cents: 1200000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "op_demo_2",
      counterpartyId: cpId,
      date: mid,
      typeId: "t3",
      number: "104",
      description: "Платёжное поручение",
      comment: "",
      cents: 2000000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  save();
  $("dateFrom").value = from;
  $("dateTo").value = mid;
  renderAll();
  $("workCounterparty").value = cpId;
  loadOpeningToForm();
  renderOperations();
  showTab("work");
}

$("loadDemo").onclick = loadDemo;
$("goCounterparties").onclick = () => showTab("counterparties");

$("dateFrom").value = monthStart();
$("dateTo").value = today();
$("opDate").value = today();
renderAll();
loadOpeningToForm();

if (new URLSearchParams(location.search).get("demo") === "1") {
  const empty = !state.counterparties.length && !state.operations.length;
  if (empty) loadDemo();
}
