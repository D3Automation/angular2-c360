import { Injectable } from '@angular/core';

@Injectable()
export class Logger {

  public log(message: string) {
    console.log(message); 
  }

  public info(message: string) {
    console.info(message); 
  }

  public warn(message: string) {
    console.warn(message); 
  }

  public error(message: string) {
    console.error(message); 
  }

  public debug(message: string) {
    console.debug(message); 
  }
}
