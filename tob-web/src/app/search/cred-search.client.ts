import { Injectable, Inject } from '@angular/core';
import { SearchClient } from './search.client';
import { SearchService } from './search.service';
import { CredentialResult } from '../data-types';


@Injectable()
export class CredSearchClient extends SearchClient<CredentialResult> {

  public resource = 'credentials';

  constructor(@Inject(SearchService) _service: SearchService) {
      super(_service);
  }

  loadResult(result: any): CredentialResult {
    return (new CredentialResult()).load(result);
  }

}
