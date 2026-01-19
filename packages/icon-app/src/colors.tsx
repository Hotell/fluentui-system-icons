import * as React from 'react'
import { makeStyles } from "@griffel/react";


import * as Icons  from '@fluentui/react-icons/svg'
import { type FluentIcon } from '@fluentui/react-icons/svg';


const useStyles = makeStyles({
 root:{

    display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap'
 },
 iconCell: {
        padding: '1em',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '200px',
 },
})

export function ColoredIconsChunk(){
        const styles = useStyles();
        return (

                <div className={styles.root}>
                {Object.keys(Icons)
                        .filter(iconName => iconName.endsWith('Color') && !/\dColor$/.test(iconName))
                        .map((iconName, index) => {
                        const IconComponent = (Icons as any)[iconName] as FluentIcon;

                        return (
                        <div key={iconName} className={styles.iconCell}>
                          <IconComponent width={48} />
                          <div>{iconName}</div>
                        </div>
                        )}
                )}
                </div>

        );
}
