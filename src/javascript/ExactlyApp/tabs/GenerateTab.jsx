import React, {useState} from 'react';
import {useMutation} from '@apollo/client';
import {useTranslation} from 'react-i18next';
import {
    Add,
    Button,
    Checkbox,
    Close,
    Dropdown,
    Field,
    Folder,
    Input,
    NumberInput,
    Star,
    Switch,
    Textarea,
    Typography
} from '@jahia/moonstone';
import {ASPECT_RATIOS, MAX_VARIATIONS, NS, REFERENCE_PURPOSES} from '../constants';
import {GENERATE_IMAGES, SAVE_GENERATED_IMAGES, errorMessage, readAnswer} from '../graphql';
import {canOpenPicker, isHttpsUrl, openPicker, readImageAsBase64} from '../media';
import {Section} from '../ui/Section';
import classes from '../ui/layout.module.css';

const MAX_PROMPT_LENGTH = 2000;

/** Step 3: generate images with the trained style, pick the good ones and save them to the media library. */
const GenerateTab = ({siteKey, language, uilang, style, onError, notify}) => {
    const {t} = useTranslation(NS);
    const [prompt, setPrompt] = useState('');
    const [count, setCount] = useState('4');
    const [ratio, setRatio] = useState('1:1');
    const [useReferences, setUseReferences] = useState(false);
    const [references, setReferences] = useState([]);
    const [generation, setGeneration] = useState(null);
    const [chosen, setChosen] = useState([]);
    const [folder, setFolder] = useState(null);
    const [title, setTitle] = useState('');

    const [generate, {loading: generating}] = useMutation(GENERATE_IMAGES);
    const [save, {loading: saving}] = useMutation(SAVE_GENERATED_IMAGES);

    const countOptions = Array.from({length: MAX_VARIATIONS}, (_, i) => ({label: String(i + 1), value: String(i + 1)}));
    const ratioOptions = Object.keys(ASPECT_RATIOS).map(value => ({label: t(`generate.ratios.${value.replace(':', 'x')}`), value}));
    const purposeOptions = REFERENCE_PURPOSES.map(value => ({
        label: t(`generate.purposes.${value}.label`),
        description: t(`generate.purposes.${value}.description`),
        value
    }));

    const addReference = () => {
        if (!canOpenPicker()) {
            onError(t('errors.noPicker'));
            return;
        }
        openPicker({
            type: 'image',
            site: siteKey,
            lang: language,
            uilang,
            onSelect: async ([item]) => {
                try {
                    const {base64, previewUrl} = await readImageAsBase64(item.path);
                    setReferences(r => [...r, {key: `${item.uuid}-${Date.now()}`, name: item.name, base64, previewUrl, purpose: 'reference', strength: '0.5'}]);
                } catch (e) {
                    const reason = ['too-large', 'not-an-image'].includes(e.message) ? t(`generate.reference.${e.message}`) : e.message;
                    onError(t('generate.reference.failed', {message: reason}));
                }
            }
        });
    };

    const updateReference = (key, changes) => setReferences(r => r.map(ref => (ref.key === key ? {...ref, ...changes} : ref)));

    const runGeneration = async () => {
        const params = {num_images: Number(count), size: ASPECT_RATIOS[ratio]};
        if (useReferences && references.length > 0) {
            params.reference_images = references.map(ref => ({
                base64: ref.base64,
                purpose: ref.purpose,
                ...(ref.purpose === 'sketch' ? {strength: Math.min(1, Math.max(0, Number(ref.strength) || 0))} : {})
            }));
        }
        try {
            const result = await generate({variables: {styleUuid: style.uuid, prompt: prompt.trim(), paramsJson: JSON.stringify(params)}});
            const answer = readAnswer(result.data?.exactly?.generateImages, {json: true});
            setGeneration(answer);
            setChosen((answer.urls || []).map((_, index) => index));
            if (!answer.urls?.length) {
                notify('warning', t('generate.noImages'));
            }
        } catch (e) {
            onError(t('generate.failed', {message: errorMessage(e)}));
        }
    };

    const pickFolder = () => {
        if (!canOpenPicker()) {
            onError(t('errors.noPicker'));
            return;
        }
        openPicker({type: 'folder', site: siteKey, lang: language, uilang, onSelect: ([item]) => setFolder(item)});
    };

    const saveChosen = async () => {
        try {
            const result = await save({
                variables: {
                    generationId: generation.generationId,
                    indices: chosen,
                    targetFolderPath: folder?.path || null,
                    title: title.trim() || null
                }
            });
            const answer = readAnswer(result.data?.exactly?.saveGeneratedImages, {json: true});
            notify('info', t('generate.saved', {saved: answer.saved, requested: answer.requested, folder: answer.folderPath}));
        } catch (e) {
            onError(t('generate.saveFailed', {message: errorMessage(e)}));
        }
    };

    const toggle = index => setChosen(c => (c.includes(index) ? c.filter(i => i !== index) : [...c, index].sort((a, b) => a - b)));
    const urls = generation?.urls || [];

    return (
        <>
            <Section title={t('generate.title')} description={t('generate.description', {name: style.name})}>
                <Field id="exactly-prompt" label={t('generate.prompt')} helper={t('generate.promptHelper', {count: prompt.length, max: MAX_PROMPT_LENGTH})}>
                    <Textarea id="exactly-prompt"
                              value={prompt}
                              rows={4}
                              maxLength={MAX_PROMPT_LENGTH}
                              isDisabled={generating}
                              placeholder={t('generate.promptPlaceholder')}
                              onChange={e => setPrompt(e.target.value)}/>
                </Field>
                <div className={classes.fields}>
                    <Field id="exactly-count" label={t('generate.count')}>
                        <Dropdown id="exactly-count" variant="outlined" data={countOptions} value={count} isDisabled={generating}
                                  onChange={(e, item) => setCount(item.value)}/>
                    </Field>
                    <Field id="exactly-ratio" label={t('generate.ratio')}>
                        <Dropdown id="exactly-ratio" variant="outlined" data={ratioOptions} value={ratio} isDisabled={generating}
                                  onChange={(e, item) => setRatio(item.value)}/>
                    </Field>
                </div>
            </Section>

            <Section
                title={t('generate.reference.title')}
                description={t('generate.reference.description')}
                actions={[
                    <Switch key="switch"
                            checked={useReferences}
                            aria-label={t('generate.reference.toggle')}
                            isDisabled={generating}
                            onChange={() => setUseReferences(v => !v)}/>
                ]}
            >
                {useReferences && (
                    <>
                        {references.map((ref, index) => (
                            <div key={ref.key} className={classes.referenceRow}>
                                <img className={classes.referenceImage} src={ref.previewUrl} alt={ref.name || ''}/>
                                <div className={classes.fields}>
                                    <Field id={`exactly-ref-purpose-${index}`} label={t('generate.reference.purpose', {index: index + 1})}>
                                        <Dropdown id={`exactly-ref-purpose-${index}`} variant="outlined" data={purposeOptions} value={ref.purpose}
                                                  isDisabled={generating}
                                                  onChange={(e, item) => updateReference(ref.key, {purpose: item.value})}/>
                                    </Field>
                                    {ref.purpose === 'sketch' && (
                                        <Field id={`exactly-ref-strength-${index}`} label={t('generate.reference.strength')} helper={t('generate.reference.strengthHelper')}>
                                            <NumberInput id={`exactly-ref-strength-${index}`} value={ref.strength} min={0} max={1} step={0.1} allowDecimal
                                                         isDisabled={generating}
                                                         onChange={e => updateReference(ref.key, {strength: e.target.value})}/>
                                        </Field>
                                    )}
                                </div>
                                <Button variant="ghost"
                                        icon={<Close/>}
                                        aria-label={t('generate.reference.remove', {index: index + 1})}
                                        isDisabled={generating}
                                        onClick={() => setReferences(r => r.filter(x => x.key !== ref.key))}/>
                            </div>
                        ))}
                        <div className={classes.row}>
                            <Button icon={<Add/>} variant="outlined" label={t('generate.reference.add')} isDisabled={generating} onClick={addReference}/>
                        </div>
                    </>
                )}
            </Section>

            <div className={classes.row}>
                <Button icon={<Star/>}
                        color="accent"
                        size="big"
                        label={generating ? t('generate.generating') : t('generate.run')}
                        isLoading={generating}
                        isDisabled={generating || prompt.trim() === ''}
                        onClick={runGeneration}/>
            </div>

            {urls.length > 0 && (
                <Section
                    title={t('generate.results', {count: urls.length})}
                    description={t('generate.resultsDescription')}
                    actions={[
                        <Button key="all" variant="ghost" label={t('generate.selectAll')} onClick={() => setChosen(urls.map((_, i) => i))}/>,
                        <Button key="none" variant="ghost" label={t('generate.selectNone')} onClick={() => setChosen([])}/>
                    ]}
                >
                    <ul className={classes.resultGrid}>
                        {urls.map((url, index) => isHttpsUrl(url) && (
                            <li key={url} className={chosen.includes(index) ? classes.resultSelected : classes.result}>
                                <img className={classes.resultImage} src={url} alt={t('generate.imageAlt', {index: index + 1})}/>
                                <div className={classes.tileBar}>
                                    <Checkbox checked={chosen.includes(index)}
                                              aria-label={t('generate.choose', {index: index + 1})}
                                              onChange={() => toggle(index)}/>
                                    <Typography variant="caption">{t('generate.imageLabel', {index: index + 1})}</Typography>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className={classes.fields}>
                        <Field id="exactly-folder" label={t('generate.folder')} helper={t('generate.folderHelper')}>
                            <div className={classes.inlineForm}>
                                <Input id="exactly-folder" className={classes.inlineInput} isReadOnly
                                       value={folder?.path || t('generate.defaultFolder')}/>
                                <Button icon={<Folder/>} variant="outlined" label={t('generate.chooseFolder')} onClick={pickFolder}/>
                            </div>
                        </Field>
                        <Field id="exactly-title" label={t('generate.fileTitle')} helper={t('generate.fileTitleHelper')}>
                            <Input id="exactly-title" value={title} maxLength={200} onChange={e => setTitle(e.target.value)}/>
                        </Field>
                    </div>
                    <div className={classes.row}>
                        <Button icon={<Folder/>}
                                color="accent"
                                label={t('generate.save', {count: chosen.length})}
                                isLoading={saving}
                                isDisabled={saving || chosen.length === 0}
                                onClick={saveChosen}/>
                    </div>
                </Section>
            )}
        </>
    );
};

export default GenerateTab;
