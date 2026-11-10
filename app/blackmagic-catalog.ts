import type {LibraryDevice,Port} from './model.ts';
type Bank=[type:string,dir:'in'|'out',count:number,label:string];
const bank=(type:string,dir:'in'|'out',count:number,label:string):Bank=>[type,dir,count,label];
const si=(n:number,label='SDI IN')=>bank('SDI','in',n,label),so=(n:number,label='SDI OUT')=>bank('SDI','out',n,label),hi=(n=1)=>bank('HDMI','in',n,'HDMI IN'),ho=(n=1,label='HDMI OUT')=>bank('HDMI','out',n,label),usb=(n=1)=>bank('USB','out',n,'WEBCAM USB-C'),ref=(loop=false):Bank[]=>[bank('Sync','in',1,'REF IN'),...(loop?[bank('Sync','out',1,'REF LOOP')]:[])];
const scope='Видеопорты, USB webcam и REF. Аудио, сеть, питание и сервисные интерфейсы не перечислены.';
const profiles:LibraryDevice[]=[];
function add(model:string,group:string,family:string,banks:Bank[],profileNote=''){profiles.push({brand:'Blackmagic Design',model,group,sourceUrl:`https://www.blackmagicdesign.com/products/${family}/techspecs`,verifiedAt:'2026-11-10',profileScope:scope,profileNote,ports:banks.flatMap(([type,dir,n,label],g)=>Array.from({length:n},(_,i):Port=>({id:`bmd-${g}-${i+1}`,label:label+(n>1?' '+(i+1):''),type,dir,connector:type==='HDMI'?'HDMI-A':type==='USB'?'USB-C':'BNC'})))})}
for(const [model,inputs,outputs,mv] of [
 ['ATEM 4 M/E Constellation 4K Plus',80,48,4],['ATEM 4 M/E Constellation 4K',40,24,4],['ATEM 2 M/E Constellation 4K',20,12,2],['ATEM 1 M/E Constellation 4K',10,6,1],['ATEM 4 M/E Constellation HD',40,24,4],['ATEM 2 M/E Constellation HD',20,12,2],['ATEM 1 M/E Constellation HD',10,6,1]
] as const)add(model,'Видеопульты','atemconstellation',[si(inputs),so(outputs,'SDI AUX'),so(mv,'SDI MULTIVIEW'),usb(),...ref()]);
add('ATEM Constellation 8K','Видеопульты','atemconstellation8k',[si(40),so(24,'SDI AUX'),so(4,'SDI MULTIVIEW'),...ref()],'В режиме 8K используются группы из четырёх SDI-разъёмов. Профиль показывает физические разъёмы; группировка quad-link не моделируется.');
for(const n of [120,80,40,20,10])add(`Blackmagic Videohub ${n}x${n} 12G`,'Матрицы','blackmagicvideohub',[si(n),so(n),...ref(true)]);
for(const [inputs,outputs,frontOut,reference] of [[8,4,true,true],[6,2,true,true],[4,2,false,false]] as const)add(`Blackmagic Videohub Mini ${inputs}x${outputs} 12G`,'Матрицы','blackmagicvideohub',[si(inputs),so(outputs),si(1,'FRONT IN (override IN '+inputs+')'),...(frontOut?[so(1,'FRONT OUT (mirror OUT '+outputs+')')]:[]),usb(),...(reference?ref(true):[])],'Передний вход заменяет задний вход '+inputs+'.'+(frontOut?' Передний выход дублирует выход '+outputs+'.':'')+' Передние разъёмы не добавляют независимые каналы маршрутизации.');
add('Smart Videohub CleanSwitch 12x12','Матрицы','blackmagicvideohub',[si(12),so(12),...ref()],'Матрица 6G-SDI с синхронизацией входов.');
for(const model of ['ATEM Television Studio 4K8','ATEM Television Studio 4K8 2TB','ATEM Television Studio HD8','ATEM Television Studio HD8 2TB','ATEM Television Studio HD8 ISO','ATEM Television Studio HD8 ISO 2TB'])add(model,'Видеопульты','atemtelevisionstudio',[si(8),...(model.includes('4K8')?[so(10,'SDI AUX')]:[so(8,'SDI CAMERA RETURN'),so(2,'SDI AUX')]),so(1,'SDI PGM'),so(1,'SDI MULTIVIEW'),ho(1,'HDMI MULTIVIEW'),usb(2),...ref(true)]);
for(const [model,inputs,outputs,webcam] of [['ATEM Mini Pro',4,1,1],['ATEM Mini Pro ISO',4,1,1],['ATEM Mini Extreme',8,2,2],['ATEM Mini Extreme ISO G2',8,3,2]] as const)add(model,'Видеопульты','atemmini',[hi(inputs),ho(outputs),usb(webcam)],'Multiview назначается на существующий HDMI-выход.'+(model.endsWith('G2')?' Thunderbolt в этом профиле не моделируется.':''));
for(const [model,inputs,outputs,webcam] of [['ATEM SDI',4,2,1],['ATEM SDI Pro ISO',4,2,1],['ATEM SDI Extreme ISO',8,4,2]] as const)add(model,'Видеопульты','atemsdi',[si(inputs),so(outputs),usb(webcam)],'Multiview назначается на существующий SDI-выход.');
for(const [model,family] of [['Mini Converter SDI Distribution','miniconverters'],['Mini Converter SDI Distribution 4K','miniconverters'],['Teranex Mini SDI Distribution 12G','teranexmini']])add(model,'Распределители',family,[si(1),so(8)]);
add('Mini Converter Sync Generator','Синхронизация','miniconverters',[bank('Sync','out',6,'REF OUT')]);
for(const rate of ['3G','12G']){
 add('Micro Converter SDI to HDMI '+rate,'Конвертеры','microconverters',[si(1),so(1,'SDI LOOP'),ho()]);
 add('Micro Converter HDMI to SDI '+rate,'Конвертеры','microconverters',[hi(),so(2)]);
 add('Micro Converter BiDirectional SDI/HDMI '+rate,'Конвертеры','microconverters',[si(1),hi(),so(1),ho()]);
}
add('Mini Converter SDI to HDMI 6G','Конвертеры','miniconverters',[si(1),si(1,'ALT SDI IN'),so(1,'SDI LOOP'),ho()],'Основной и резервный SDI-входы относятся к одному тракту преобразования.');
add('Mini Converter HDMI to SDI 6G','Конвертеры','miniconverters',[hi(),so(2)]);
add('Mini Converter UpDownCross HD','Конвертеры','miniconverters',[si(1),hi(),...ref(),so(1,'SDI LOOP'),so(2),ho()]);
add('Teranex Mini SDI to HDMI 12G','Конвертеры','teranexmini',[si(1),so(1,'SDI LOOP'),ho()]);
add('Teranex Mini HDMI to SDI 12G','Конвертеры','teranexmini',[hi(),so(2)]);
add('Teranex Mini 12G-SDI to Quad SDI','Конвертеры','teranexmini',[si(1),so(4),so(1,'12G SDI LOOP')],'Четыре SDI-выхода образуют quad-link; совместимость форматов отдельно не проверяется.');
add('Teranex Mini Quad SDI to 12G-SDI','Конвертеры','teranexmini',[si(4),so(2)],'Четыре SDI-входа образуют quad-link; совместимость форматов отдельно не проверяется.');
export const blackmagicCatalog=profiles;
