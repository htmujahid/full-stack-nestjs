'use client';

import { Fragment } from 'react';

import { useLocation } from 'react-router';

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const unslugify = (slug: string) => slug.replace(/-/g, ' ');

export function AppBreadcrumbs(props: {
  values?: Record<string, string>;
  maxDepth?: number;
}) {
  const pathName = useLocation().pathname;
  const splitPath = pathName.split('/').filter(Boolean);
  const values = props.values ?? {};
  const maxDepth = props.maxDepth ?? 6;

  const Ellipsis = (
    <BreadcrumbItem>
      <BreadcrumbEllipsis className="h-4 w-4" />
    </BreadcrumbItem>
  );

  const showEllipsis = splitPath.length > maxDepth;

  const visiblePaths = showEllipsis
    ? ([splitPath[0], ...splitPath.slice(-maxDepth + 1)] as string[])
    : splitPath;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {visiblePaths.map((path, index) => {
          const label = path in values ? values[path] : unslugify(path);

          return (
            <Fragment key={index}>
              <BreadcrumbItem className={'capitalize lg:text-xs'}>
                {
                  index < (visiblePaths.length - 1) ?
                    <BreadcrumbLink
                      href={
                        '/' +
                        splitPath.slice(0, splitPath.indexOf(path) + 1).join('/')
                      }
                    >
                      {label}
                    </BreadcrumbLink> :
                    label
                }
              </BreadcrumbItem>

              {index === 0 && showEllipsis && (
                <>
                  <BreadcrumbSeparator />
                  {Ellipsis}
                </>
              )}

              {
                index !== (visiblePaths.length - 1) &&
                <BreadcrumbSeparator />
              }

            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}