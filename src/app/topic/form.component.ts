import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppConfigService } from '../app-config.service';
import { GeneralDataService } from '../general-data.service';
import { Fetch, Model } from '../data-types';
import { Subscription } from 'rxjs';
import { HttpService } from 'app/core/services/http.service';
import { ICredentialSet } from 'app/core/interfaces/i-credential-set.interface';
import { TopicStateService } from './services/topic-state.service';

@Component({
  selector: 'topic-form',
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.scss'],
})
export class TopicFormComponent implements OnInit, OnDestroy {
  source_type: string;
  source_id: string;
  credsFormat: string = 'rows';
  _filterActive: boolean = true;
  showFilters: boolean = false;
  _sectionsLoaded = {};

  private _loader = new Fetch.ModelLoader(Model.TopicFormatted);

  private _creds = new Fetch.ModelListLoader(Model.TopicCredentialSearchResult);

  private _idSub: Subscription;

  constructor(
    private _config: AppConfigService,
    private _dataService: GeneralDataService,
    private _route: ActivatedRoute,
    private httpSvc: HttpService,
    public stateSvc: TopicStateService,
    private _router: Router,
  ) {}

  async ngOnInit() {
    this._sectionsLoaded = {};
    this._loader.ready.subscribe(result => {
      this._fetchCreds();
      const id = this._loader.result.data.id;
      this.httpSvc
        .httpGetRequest<ICredentialSet[]>(`topic/${id}/credentialset`)
        .toPromise()
        .then((res: ICredentialSet[]) => {
          /*
          TEST DATA
          const addresses = [];
          const attributes = [];
          const create_timestamp = '2019-09-11T14:25:48.839442-07:00';
          const update_timestamp = '2019-09-12T14:25:48.839442-07:00';
          const effective_date = '';
          const id = 9;
          const inactive = true;
          const latest = false;
          const issuer = { create_timestamp, update_timestamp };
          const credential_type = { description: 'Blah blah', issuer };
          const local_name = {
            credential_id: 9,
            id: 4,
            language: null,
            text: 'test2',
            type: 'legal_name'
          };
          const names = [];
          const related_topics = [];
          const remote_name = null;
          const topic = res[0].credentials[0].topic;
          const wallet_id = res[0].credentials[0].wallet_id;
          res[0].credentials.push({
            addresses,
            attributes,
            create_timestamp,
            credential_type,
            effective_date,
            id,
            inactive,
            local_name,
            latest,
            names,
            related_topics,
            remote_name,
            topic,
            wallet_id,
            update_timestamp
          } as any);
           */
          this.stateSvc.setCredential(res);
        })
        .catch(err => console.error(err));
    });
    this._loader.postProc(
      val =>
        new Promise(resolve => {
          if (val && val.data) {
            let ids = {};
            let attrs = val.data.attributes;
            if (attrs) {
              for (let row of attrs) {
                if (row.credential_type_id) ids[row.credential_type_id] = 1;
              }
            }
            if (ids) {
              return this._dataService.preloadCredentialTypeLanguage(...Object.keys(ids)).then(_ => {
                resolve(val);
              });
            }
          }
          resolve(val);
        }),
    );

    this._idSub = this._route.params.subscribe(params => {
      this.source_type = params['sourceType'];
      this.source_id = params['sourceId'];
      let ident = this.ident;
      this._dataService.loadRecord(this._loader, ident, { primary: true });
    });
    let format = this._config.getConfig().TOPIC_CREDS_FORMAT;
    if (format) this.credsFormat = format;
  }

  ngOnDestroy() {
    this._idSub.unsubscribe();
    this._loader.complete();
    this._creds.complete();
  }

  get ident(): string {
    let source_type = this.source_type || this._dataService.defaultTopicType;
    if (source_type && this.source_id) {
      return this.source_type === '_' ? this.source_id : `ident/${source_type}/${this.source_id}`;
    }
  }

  get title(): string {
    let names = this.topic.names;
    if (names && names.length) {
      return names[0].text;
    }
  }

  get topic(): Model.TopicFormatted {
    return this._loader.result.data;
  }

  get names(): Model.Name[] {
    return this.topic && this.topic.names;
  }

  get result$() {
    return this._loader.stream;
  }

  get creds$() {
    return this._creds.stream;
  }

  get filterActive(): string {
    return this._filterActive ? 'true' : 'false';
  }

  set filterActive(active: string) {
    this._filterActive = active === 'true';
    this._fetchCreds();
  }

  protected _fetchCreds() {
    let credsFilter = {
      topic_id: '' + this.topic.id,
      revoked: this._filterActive ? 'false' : '',
    };
    // this._dataService.loadList(this._creds, { query: credsFilter });
  }

  protected onLoadSection(name, state?) {
    this._sectionsLoaded[name] = state === undefined ? true : state;
  }

  protected isLoaded(...sections: string[]) {
    if (!sections) sections = ['all'];
    for (let s of sections) {
      let state = null;
      if (s === 'all') {
        if (this._loader.result.error) state = true;
        else state = this.isLoaded('topic', /*'related_to', */ 'related_to_relations' /*, 'related_from', 'creds'*/);
      } else if (s === 'topic') {
        state = this._loader.result.loaded;
      } else {
        state = s in this._sectionsLoaded;
      }
      if (!state) return false;
    }
    return true;
  }
}
