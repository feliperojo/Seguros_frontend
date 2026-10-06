import test from 'node:test';
import assert from 'node:assert/strict';
import {filasInformePagos} from './informePagosCobertura.js';
const filtros={anio:2026};
const pago=(id,mes,snap)=>({id,cobertura_id:21,anio_generado:2026,mes_generado:mes,estado:'pendiente',cobertura_snapshot:snap,cobertura_fiscal_informe:{compania_nombre:'Actual',codigo_poliza:'A',pagador_nombre:'Tomador'},cliente:{nombre_completo:'Cliente'}});
test('snapshots diferentes no separan cobertura y columnas usan datos fiscales',()=>{
const rows=filasInformePagos([pago(1,'10',null),pago(2,'11',{compania_nombre:'Anterior'})],filtros);
assert.equal(rows.length,1);assert.equal(rows[0].compania,'Actual');assert.equal(rows[0].pagos[10].cobros[0].cobertura_snapshot.compania_nombre,'Anterior');
});
test('no descarta cobros del mismo mes ni mezcla coberturas',()=>{
const rows=filasInformePagos([pago(1,'10'),pago(2,'10'),{...pago(3,'10'),cobertura_id:22}],filtros);
assert.equal(rows.length,2);assert.equal(rows[0].pagos[9].cobros.length,2);
});
test('no completa datos fiscales ausentes con snapshots ni incluye otro año',()=>{
const rows=filasInformePagos([{...pago(1,'10',{compania_nombre:'Historica'}),cobertura_fiscal_informe:null},{...pago(2,'11'),anio_generado:2027}],filtros);
assert.equal(rows.length,1);assert.equal(rows[0].compania,undefined);
assert.equal(filasInformePagos([pago(1,'10')],{...filtros,compania:'Anterior'}).length,0);
});
