import { Thalia } from './thalia';
import { Server as SocketIoServer } from 'socket.io';
declare function socketInit(io: SocketIoServer, handle: Thalia.Handle): void;
export { socketInit };
