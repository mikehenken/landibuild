import { open, type FileHandle } from 'node:fs/promises';

type State = { offset: number; carry: string };

export class JsonlTail {
	private readonly states = new Map<string, State>();

	constructor(private readonly fromEndOnFirstSeen: boolean) {}

	/**
	 * Read new complete lines appended since last call. Handles line fragments across reads.
	 */
	async consumeFile(filePath: string): Promise<string[]> {
		let st = this.states.get(filePath);
		let fh: FileHandle | undefined;
		try {
			fh = await open(filePath, 'r');
			const info = await fh.stat();
			if (!st) {
				st = {
					offset: this.fromEndOnFirstSeen ? info.size : 0,
					carry: '',
				};
				this.states.set(filePath, st);
			}
			if (info.size < st.offset) {
				st.offset = 0;
				st.carry = '';
			}
			const len = info.size - st.offset;
			let chunk = '';
			if (len > 0) {
				const buf = Buffer.alloc(len);
				await fh.read(buf, 0, len, st.offset);
				chunk = buf.toString('utf8');
				st.offset = info.size;
			}
			await fh.close();

			const full = st.carry + chunk;
			const lines = full.split('\n');
			st.carry = lines.pop() ?? '';
			return lines.map((l) => l.trim()).filter((l) => l.length > 0);
		} catch (e: unknown) {
			const err = e as { code?: string };
			try {
				await fh?.close();
			} catch {
				/* ignore */
			}
			if (err.code === 'ENOENT') {
				return [];
			}
			throw e;
		}
	}
}
