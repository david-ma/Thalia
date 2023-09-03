import { Thalia } from './thalia';
declare function crud(options: {
    tableName: string;
}): {
    [x: string]: (controller: Thalia.Controller) => void;
};
declare const _default: {
    crud: typeof crud;
};
export default _default;
