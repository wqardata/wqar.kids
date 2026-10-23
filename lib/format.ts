/** صيغة عدد المشاهدات بالمفرد والمثنى والجمع الصحيحة في العربية. */
export function viewsLabel(n: number): string {
  if (n === 0) return "لا مشاهدات";
  if (n === 1) return "مشاهدة واحدة";
  if (n === 2) return "مشاهدتان";
  const num = new Intl.NumberFormat("ar-u-nu-latn").format(n);
  return n <= 10 ? `${num} مشاهدات` : `${num} مشاهدة`;
}
