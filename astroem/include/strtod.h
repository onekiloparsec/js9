/* Project source file. Attribution is centralized in README.md. */

/*
 *
 * strtod.h -- declarations for SAOstrtod()
 *
 */

#ifndef	__strtod_h
#define	__strtod_h

extern int SAOdtype;

double SAOstrtod(char *s, char **t);
char *SAOconvert(char *buff, double val, int type, int prec);

#endif
