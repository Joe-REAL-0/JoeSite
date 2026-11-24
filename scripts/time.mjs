/**
 * 时间处理。
 *
 * 旧站把时间存成不带时区的 `YYYY-MM-DD HH:MM:SS`，其值取东八区（见旧站 get_china_time）。
 * 这里固定按 +08:00 解释与格式化，构建机器的本地时区不会让日期换日。
 */

const CHINA_OFFSET = "+08:00";
const STORED = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * 把旧站时间字符串解析为绝对时间点。
 * @param {unknown} value 形如 "2024-05-06 12:34:56"，也接受带时区的 ISO 串
 * @returns {Date|null} 无法解析时返回 null
 */
export function parseChinaTime(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;

  const match = STORED.exec(value.trim());
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    const iso = `${year}-${month}-${day}T${hour}:${minute}:${second ?? "00"}${CHINA_OFFSET}`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** 东八区的各时间分量。 */
function chinaParts(date) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

const pad = (value) => String(value).padStart(2, "0");

/**
 * 还原旧站的展示字符串 `YYYY-MM-DD HH:MM:SS`，用于列表和详情的时间标签。
 * @returns {string} 无法解析时返回空串
 */
export function formatChinaTime(value) {
  const date = parseChinaTime(value);
  if (!date) return "";
  const p = chinaParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/** 只取日期部分 `YYYY-MM-DD`。 */
export function formatChinaDate(value) {
  const date = parseChinaTime(value);
  if (!date) return "";
  const p = chinaParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/**
 * RSS / sitemap 使用的 RFC 822 时间，固定 +0800。
 * @returns {string} 无法解析时返回空串
 */
export function formatRfc822(value) {
  const date = parseChinaTime(value);
  if (!date) return "";
  const p = chinaParts(date);
  return `${WEEKDAYS[p.weekday]}, ${pad(p.day)} ${MONTHS[p.month - 1]} ${p.year} ` +
    `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)} +0800`;
}
