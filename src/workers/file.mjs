import fs from "fs";

let data;

export class FileHandling {
    static Read(path) {
        try {
            data = fs.readFileSync(path, 'utf-8');
        } catch (e) {
            console.log(e);
        } finally {
            return (data);
        };
    };
};