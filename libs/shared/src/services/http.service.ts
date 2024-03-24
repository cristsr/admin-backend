import { Injectable } from '@nestjs/common';
import Axios, { AxiosInstance, AxiosPromise, AxiosRequestConfig } from 'axios';
import { Observable } from 'rxjs';

@Injectable()
export class HttpClient {
  constructor(protected instance: AxiosInstance = Axios) {}

  request<T = any>(config: AxiosRequestConfig): Observable<T> {
    return this.makeObservable<T>(this.instance.request, config);
  }

  get<T = any>(url: string, config?: AxiosRequestConfig): Observable<T> {
    return this.makeObservable<T>(this.instance.get, url, config);
  }

  delete<T = any>(url: string, config?: AxiosRequestConfig): Observable<T> {
    return this.makeObservable<T>(this.instance.delete, url, config);
  }

  head<T = any>(url: string, config?: AxiosRequestConfig): Observable<T> {
    return this.makeObservable<T>(this.instance.head, url, config);
  }

  post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Observable<T> {
    return this.makeObservable<T>(this.instance.post, url, data, config);
  }

  put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Observable<T> {
    return this.makeObservable<T>(this.instance.put, url, data, config);
  }

  patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Observable<T> {
    return this.makeObservable<T>(this.instance.patch, url, data, config);
  }

  get axiosRef(): AxiosInstance {
    return this.instance;
  }

  protected makeObservable<T>(
    axios: (...args: any[]) => AxiosPromise<T>,
    ...args: any[]
  ) {
    return new Observable<T>((subscriber) => {
      const config: AxiosRequestConfig = { ...(args[args.length - 1] || {}) };

      let controller: AbortController;
      if (!config.signal) {
        controller = new AbortController();
        config.signal = controller.signal;
      }

      axios(...args)
        .then((res) => {
          subscriber.next(res.data);
          subscriber.complete();
        })
        .catch((err) => {
          subscriber.error(err);
        });
      return () => {
        if (config.responseType === 'stream') {
          return;
        }

        if (controller) {
          controller.abort();
        }
      };
    });
  }
}
