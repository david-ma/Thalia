import { Thalia } from './thalia';
type SecurityMiddleware = (controller: Thalia.Controller, success: ([Views, UserModel]: [any, any]) => void, failure?: () => void) => Promise<void>;
declare function crud(options: {
    tableName: string;
    security?: SecurityMiddleware;
}): {
    [x: string]: (controller: Thalia.Controller) => void;
};
declare const _default: {
    crud: typeof crud;
};
export default _default;
