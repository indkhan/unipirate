import {z} from "zod";
const timestamp=z.string().datetime({offset:true});
/** Preserve PostgreSQL microseconds; Date alone rounds same-day publication races. */
export function instantOrder(value:string):bigint {
 const valid=timestamp.parse(value);
 const fraction=valid.match(/\.(\d+)/)?.[1]??'';
 if(fraction.length>6)throw new Error('Instant precision exceeds PostgreSQL microseconds.');
 const whole=valid.replace(/\.\d+/, '');
 return BigInt(new Date(whole).getTime())*BigInt(1000)+BigInt(fraction.padEnd(6,'0'));
}
