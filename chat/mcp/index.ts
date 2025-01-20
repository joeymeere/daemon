import memapp from "./memserver";
import idapp from "./idserver";

try {
    Bun.serve(idapp);
    Bun.serve(memapp);
} catch (e) {
    console.error(e);
} 
