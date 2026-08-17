// Indian-numbering rupees-to-words for the printed quotation.
// Converts BigInt paise → e.g. "One Lakh Twenty Thousand Rupees Only".

const ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
  "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

function _w(x: number): string {
  if (x === 0) return "";
  if (x < 20) return ONES[x]!;
  if (x < 100) return (TENS[Math.floor(x/10)]! + (x%10 ? " "+ONES[x%10]! : "")).trim();
  return (ONES[Math.floor(x/100)]! + " Hundred" + (x%100 ? " "+_w(x%100) : "")).trim();
}

export function rupeesToWords(paise: bigint): string {
  const n = Number(paise / 100n);
  if (n <= 0) return "Zero Rupees Only";
  const parts: string[] = [];
  let r = n;
  if (r >= 10000000) { parts.push(_w(Math.floor(r/10000000))+" Crore"); r%=10000000; }
  if (r >= 100000)   { parts.push(_w(Math.floor(r/100000))+" Lakh");    r%=100000; }
  if (r >= 1000)     { parts.push(_w(Math.floor(r/1000))+" Thousand");  r%=1000; }
  if (r > 0)         { parts.push(_w(r)); }
  return parts.join(" ") + " Only";
}
