const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const out=path.join(root,'dist');
fs.mkdirSync(out,{recursive:true});
function copy(dir,relative=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
 if(e.name.startsWith('.')||['node_modules','dist','tests','scripts'].includes(e.name))continue;
 const rel=path.join(relative,e.name);const src=path.join(dir,e.name);const dst=path.join(out,rel);
 if(e.isDirectory())copy(src,rel);else if(/\.(html|js|css|png)$/.test(e.name)){fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);}
}}
copy(root);console.log('Static site packaged in dist/.');
