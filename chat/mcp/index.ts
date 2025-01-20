import memapp from "./memserver";
import idapp from "./idserver";

try {
    Bun.serve({
        ...idapp,
        idleTimeout: 255 
    });
    Bun.serve({
        ...memapp,
        idleTimeout: 255 
    });
} catch (e) {
    console.error(e);
} 
