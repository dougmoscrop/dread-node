type JitterOptions = {
  base?: number = 100;
  factor?: number = 2;
  limit?: number = 1000;
  jitter?: JitterType = JitterType.FULL;
};

export enum JitterType {
  NONE = "NONE",
  FULL = "FULL",
  HALF = "HALF",
}

export type DreadConfig = {
  timeout?: number = undefined;
  attempts: number = 10;
  backoff?: number;
  condition?: (err: any) => boolean;
};

export type Attempt = {
  attempt: number;
  number: number;
  cancel: (reason: string | any = "Attempt cancelled") => void;
  timeout: (duration: number) => void;
};

type DreadFunction = {
  (
    task: (attempt: Attempt) => void | any | Promise<any>,
    config?: DreadConfig
  ): void;
  (config?: DreadConfig): DreadFunction;
  prop: (key: string) => boolean;
  is: (classInstance: any) => boolean;
  code: (str: string) => boolean;
  always: () => true;
  exp: (options?: JitterOptions) => (numb: number) => number;
};

declare const dread: DreadFunction;

export default dread;
