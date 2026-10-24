import React, {useCallback, useState} from 'react';
import {shallowEqual, useSelector} from 'react-redux';
import {useQuery} from '@apollo/client';
import {useTranslation} from 'react-i18next';
import {Banner, Button, Close, Header, LayoutContent, Tab, TabItem} from '@jahia/moonstone';
import {NS, STATUS, TABS} from './constants';
import {CONFIGURED} from './graphql';
import StylesTab from './tabs/StylesTab';
import TrainingTab from './tabs/TrainingTab';
import GenerateTab from './tabs/GenerateTab';
import layout from './ui/layout.module.css';

/**
 * Root of the jContent app: a Moonstone Header with one tab per step (style, training, generation)
 * and the step's content. Remounted per site so that nothing chosen on a site leaks to another.
 */
const ExactlyApp = () => {
    const {siteKey, language, uilang} = useSelector(state => ({
        siteKey: state.site,
        language: state.language,
        uilang: state.uilang
    }), shallowEqual);
    return <ExactlySite key={siteKey} siteKey={siteKey} language={language} uilang={uilang}/>;
};

const ExactlySite = ({siteKey, language, uilang}) => {
    const {t} = useTranslation(NS);
    const [tab, setTab] = useState('styles');
    const [style, setStyle] = useState(null);
    const [notice, setNotice] = useState(null);
    const {data: configData} = useQuery(CONFIGURED, {variables: {siteKey}, fetchPolicy: 'network-only'});
    const configured = configData?.exactly?.configured;

    const notify = useCallback((variant, message) => setNotice(message ? {variant, message} : null), []);
    const onError = useCallback(message => notify('danger', message), [notify]);

    const selectStyle = useCallback(selected => {
        setStyle(selected);
        setNotice(null);
    }, []);
    const changeTab = useCallback(key => {
        setTab(key);
        setNotice(null);
    }, []);
    const setStyleStatus = useCallback(status => setStyle(s => (s ? {...s, status} : s)), []);

    const isReachable = key => {
        if (key === 'styles') {
            return true;
        }
        if (!style) {
            return false;
        }
        return key === 'training' || style.status === STATUS.READY;
    };

    const context = {siteKey, language, uilang, style, onError, notify};

    return (
        <div className={layout.root}>
            <LayoutContent
                header={(
                    <Header
                        title={t('app.title')}
                        toolbarLeft={[
                            <div key="tabs" className={layout.tabsScroll}>
                                <Tab>
                                    {TABS.map((key, index) => (
                                        <TabItem key={key}
                                                 label={t(`tabs.${key}`, {index: index + 1})}
                                                 isSelected={tab === key}
                                                 isDisabled={!isReachable(key)}
                                                 onClick={() => isReachable(key) && changeTab(key)}/>
                                    ))}
                                </Tab>
                            </div>
                        ]}
                    />
                )}
                content={(
                    <div className={layout.content}>
                        <div className={layout.page}>
                            {configured === false && (
                                <Banner variant="warning" title={t('config.missingTitle')}>
                                    {t('config.missing')}
                                </Banner>
                            )}
                            {notice && (
                                <Banner variant={notice.variant} title={t(`notice.${notice.variant}`)}>
                                    <div className={layout.bannerBody}>
                                        <span className={layout.wrap}>{notice.message}</span>
                                        <Button variant="ghost" icon={<Close/>} aria-label={t('actions.dismiss')} onClick={() => setNotice(null)}/>
                                    </div>
                                </Banner>
                            )}
                            {tab === 'styles' && (
                                <StylesTab {...context}
                                           canCallExactly={configured !== false}
                                           onSelect={selected => {
                                               selectStyle(selected);
                                               changeTab(selected.status === STATUS.READY ? 'generate' : 'training');
                                           }}/>
                            )}
                            {tab === 'training' && style && (
                                <TrainingTab {...context}
                                             onStatusChange={setStyleStatus}
                                             onGoToGenerate={() => changeTab('generate')}/>
                            )}
                            {tab === 'generate' && style && <GenerateTab {...context}/>}
                        </div>
                    </div>
                )}
            />
        </div>
    );
};

export default ExactlyApp;
