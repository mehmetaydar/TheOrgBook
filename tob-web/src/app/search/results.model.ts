
export class SearchInfo {
  public pageNum: number = 1;
  public pageCount: number = 0;
  public resultCount: number = 0;
  public totalCount: number = 0;
  public firstIndex = 0;
  public lastIndex = 0;
  public timing: number = 0;
  public previous: string = null;
  public next: string = null;
  public params: {[key: string]: any};

  get havePrevious() {
    return this.previous != null;
  }

  get haveNext() {
    return this.next != null;
  }
}

export class SearchResults<T> {
  public info: SearchInfo;
  private _rows: T[] = [];

  constructor(
    info: SearchInfo,
    rows: T[],
  ) {
    this.info = info;
    this.rows = rows;
  }

  get rows() : T[] {
    return this._rows;
  }

  set rows(vals: T[]) {
    this._rows = [...vals];
  }
}

export class SearchResult<T> {
  public info: SearchInfo;
  private _data: T = null;

  constructor(
    info: SearchInfo,
    data: T,
  ) {
    this.info = info;
    this._data = data;
  }

  get data() : T {
    return this._data;
  }

  set rows(data: T) {
    this._data = data;
  }
}
