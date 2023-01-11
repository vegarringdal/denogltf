import { Parser } from "./Parser.ts";

await Deno.remove("./temp", { recursive: true });
await Deno.remove("export", { recursive: true });

await Deno.mkdir("temp");
const cmd = ["./rvmparser.exe", "--tolerance=0.01", "--output-gltf-split-level=3", "./rvm/osa.rvm", "--output-gltf=./temp/osa.glb"];
const p = Deno.run({ cmd, stderr: 'inherit', stdout: 'inherit' })
await p.status().catch((e)=>{
    console.log(e)
}); 


await Deno.mkdir("export");
for await (const dirEntry of Deno.readDir('temp')) {
    if(dirEntry.isFile && dirEntry.name?.toLowerCase().includes(".glb")){
        const parser = new Parser();
        await parser.parse("./temp/"+dirEntry.name, dirEntry.name.replace(".glb", ""), "./export/");
    }
}


